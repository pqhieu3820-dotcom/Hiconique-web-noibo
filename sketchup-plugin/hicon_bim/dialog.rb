# encoding: UTF-8
require 'json'
require_relative 'config'
require_relative 'scanner'
require_relative 'api_client'

module HiconBim
  module Dialog
    @html_dialog = nil

    LEVEL_DICT = 'HiconBim'.freeze
    LEVEL_KEY = 'levels'.freeze

    def self.show
      if @html_dialog && @html_dialog.visible?
        @html_dialog.bring_to_front
        return
      end

      @html_dialog = UI::HtmlDialog.new(
        dialog_title: 'HICON-BIM',
        preferences_key: 'com.hiconique.hicon_bim',
        scrollable: true, resizable: true, width: 420, height: 760,
        min_width: 360, min_height: 500
      )
      @html_dialog.set_file(File.join(__dir__, 'html', 'panel.html'))
      wire_callbacks(@html_dialog)
      @html_dialog.show
    end

    def self.push(event, payload)
      return unless @html_dialog
      json = JSON.generate(payload)
      @html_dialog.execute_script("window.hiconBimReceive && window.hiconBimReceive(#{JSON.generate(event)}, #{json});")
    end

    def self.default_levels
      [
        { name: 'Tầng 01', elevationMin: 0.0, elevationMax: 3.6 },
        { name: 'Tầng 02', elevationMin: 3.6, elevationMax: 7.2 }
      ]
    end

    def self.load_levels
      model = Sketchup.active_model
      dict = model.attribute_dictionary(LEVEL_DICT)
      raw = dict ? dict[LEVEL_KEY] : nil
      raw ? JSON.parse(raw, symbolize_names: true) : default_levels
    rescue StandardError
      default_levels
    end

    def self.save_levels(levels)
      model = Sketchup.active_model
      model.attribute_dictionary(LEVEL_DICT, true)[LEVEL_KEY] = JSON.generate(levels)
    end

    def self.wire_callbacks(dialog)
      dialog.add_action_callback('ready') do |_ctx|
        push('bootstrap', {
          config: Config.to_h,
          model: { fileName: Scanner.model_file_name, guid: Scanner.model_guid },
          levels: load_levels
        })
      end

      dialog.add_action_callback('saveSettings') do |_ctx, payload|
        data = JSON.parse(payload)
        Config.api_url = data['apiUrl']
        Config.project_id = data['projectId']
        Config.project_name = data['projectName']
        push('settingsSaved', Config.to_h)
      end

      dialog.add_action_callback('scanObjects') do |_ctx|
        with_error_reporting('scanObjects') do
          levels = load_levels
          objects = Scanner.scan_objects(levels: levels)
          push('objects', { objects: objects, count: objects.length })
        end
      end

      dialog.add_action_callback('syncObjects') do |_ctx|
        with_error_reporting('syncObjects') do
          raise ApiClient::ApiError, 'Chưa cấu hình API URL / Mã dự án — mở Cài đặt.' unless Config.configured?
          levels = load_levels
          objects = Scanner.scan_objects(levels: levels)
          model_id = ApiClient.upsert_model(
            projectId: Config.project_id,
            fileName: Scanner.model_file_name,
            modelGuid: Scanner.model_guid
          )
          objects_with_project = objects.map { |o| o.merge(projectId: Config.project_id, modelId: model_id) }
          result = ApiClient.sync_objects(model_id, objects_with_project, Config.member_name)
          push('synced', { count: result['count'], objects: objects })
        end
      end

      dialog.add_action_callback('scanLevels') do |_ctx|
        with_error_reporting('scanLevels') { push('levels', { levels: load_levels }) }
      end

      dialog.add_action_callback('saveLevels') do |_ctx, payload|
        with_error_reporting('saveLevels') do
          levels = JSON.parse(payload, symbolize_names: true)
          save_levels(levels)
          push('levels', { levels: levels })
        end
      end

      # "Tạo từ selection": lấy khoảng cao độ Z (m) của object đang chọn để
      # gợi ý elevationMin/elevationMax cho 1 Level mới, đỡ phải đo tay.
      dialog.add_action_callback('levelFromSelection') do |_ctx|
        with_error_reporting('levelFromSelection') do
          sel = Sketchup.active_model.selection
          raise ApiClient::ApiError, 'Chưa chọn object nào trên model.' if sel.empty?
          bounds = Geom::BoundingBox.new
          sel.each { |e| bounds.add(e.bounds) }
          push('levelFromSelection', {
            elevationMin: (bounds.min.z * Scanner::IN_TO_M).round(2),
            elevationMax: (bounds.max.z * Scanner::IN_TO_M).round(2)
          })
        end
      end

      dialog.add_action_callback('scanSpaces') do |_ctx|
        with_error_reporting('scanSpaces') { push('spaces', { spaces: Scanner.scan_spaces }) }
      end

      dialog.add_action_callback('scanMaterials') do |_ctx|
        with_error_reporting('scanMaterials') { push('materials', { materials: Scanner.scan_materials }) }
      end

      # Filter tab: chạy điều kiện lên đúng danh sách Object vừa scan, rồi
      # tuỳ hành động mà Preview (tô sáng tạm), Highlight (add vào selection)
      # hay Safe Isolate (ẩn hết object không khớp) ngay trên model thật.
      dialog.add_action_callback('runFilter') do |_ctx, payload|
        with_error_reporting('runFilter') do
          req = JSON.parse(payload, symbolize_names: true)
          levels = load_levels
          matched_guids, total = FilterEngine.run(req[:conditions], req[:matchAll], levels)
          apply_filter_action(req[:mode], matched_guids)
          push('filterResult', { matched: matched_guids.length, total: total })
        end
      end

      dialog.add_action_callback('clearFilter') do |_ctx|
        with_error_reporting('clearFilter') do
          Sketchup.active_model.entities.each { |e| e.visible = true if e.respond_to?(:visible=) }
          Sketchup.active_model.selection.clear
          push('filterCleared', {})
        end
      end

      # BOQ tab: khớp defName của Object đã scan với danh mục Sản phẩm HICON-
      # BIM thật (getBimProducts) theo tên trùng khớp không phân biệt hoa
      # thường — object không khớp được gộp vào "Chưa gán sản phẩm" để người
      # dùng biết còn thiếu gì, không âm thầm bỏ qua.
      dialog.add_action_callback('generateBoq') do |_ctx|
        with_error_reporting('generateBoq') do
          raise ApiClient::ApiError, 'Chưa cấu hình API URL / Mã dự án — mở Cài đặt.' unless Config.configured?
          levels = load_levels
          objects = Scanner.scan_objects(levels: levels)
          products = ApiClient.get_products
          summary = BoqBuilder.build(objects, products)
          push('boqPreview', { rows: summary[:rows], unmatched: summary[:unmatchedCount] })
        end
      end

      dialog.add_action_callback('pushBoq') do |_ctx, payload|
        with_error_reporting('pushBoq') do
          rows = JSON.parse(payload, symbolize_names: true)
          existing = ApiClient.get_boq_items(Config.project_id)
          rows.each_with_index do |row, i|
            data = {
              projectId: Config.project_id, code: 'A.' + (i + 1).to_s.rjust(2, '0'),
              productId: row[:productId], name: row[:name], unit: row[:unit],
              quantity: row[:quantity], unitPrice: row[:unitPrice]
            }
            match = existing.find { |r| r['productId'] == row[:productId] }
            match ? ApiClient.update_boq_item(match['id'], data) : ApiClient.add_boq_item(data)
          end
          push('boqPushed', { count: rows.length })
        end
      end
    end
    private_class_method :wire_callbacks

    def self.apply_filter_action(mode, matched_guids)
      model = Sketchup.active_model
      case mode
      when 'highlight'
        model.selection.clear
        Scanner.each_object(model.entities) { |e| model.selection.add(e) if matched_guids.include?(e.persistent_id.to_s) }
      when 'isolate'
        Scanner.each_object(model.entities) { |e| e.visible = matched_guids.include?(e.persistent_id.to_s) }
      end
    end
    private_class_method :apply_filter_action

    def self.with_error_reporting(label)
      yield
    rescue ApiClient::ApiError => e
      push('error', { label: label, message: e.message })
    rescue StandardError => e
      push('error', { label: label, message: "#{e.class}: #{e.message}" })
    end
    private_class_method :with_error_reporting
  end

  # Điều kiện lọc dạng {field, op, value} — field khớp đúng tên cột đã hiện
  # ở tab Objects (tagName/group/ifcClass/level/materialName...), so khớp
  # chuỗi (chứa/bằng) hoặc số (so sánh) tuỳ kiểu giá trị.
  module FilterEngine
    def self.run(conditions, match_all, levels)
      objects = Scanner.scan_objects(levels: levels)
      matched = objects.select do |o|
        match_all ? conditions.all? { |c| test(o, c) } : conditions.any? { |c| test(o, c) }
      end
      [matched.map { |o| o[:elementGuid] }, objects.length]
    end

    def self.test(obj, cond)
      field = cond[:field].to_sym
      value = obj[field]
      target = cond[:value].to_s
      case cond[:op]
      when 'eq' then value.to_s.downcase == target.downcase
      when 'contains' then value.to_s.downcase.include?(target.downcase)
      when 'gt' then value.to_f > target.to_f
      when 'lt' then value.to_f < target.to_f
      else false
      end
    end
  end

  # Ghép Object đã scan với danh mục Sản phẩm HICON-BIM thật (theo tên định
  # nghĩa == tên sản phẩm, không phân biệt hoa thường) để ra khối lượng BOQ.
  module BoqBuilder
    def self.build(objects, products)
      by_name = {}
      products.each { |p| by_name[p['name'].to_s.strip.downcase] = p }

      grouped = Hash.new { |h, k| h[k] = { quantity: 0.0, unit: nil, productId: nil, name: nil, unitPrice: 0 } }
      unmatched = 0
      objects.each do |o|
        product = by_name[o[:defName].to_s.strip.downcase]
        unless product
          unmatched += 1
          next
        end
        # scan_objects trả 1 dòng / 1 instance đã đặt trong model (không phải
        # 1 dòng / definition), nên đơn vị đếm cái/bộ chỉ cần +1 mỗi dòng —
        # KHÔNG được cộng o[:instanceCount] (đó là tổng số instance của cả
        # definition, cộng theo đó sẽ nhân trùng N lần cho N instance).
        qty = product['unit'].to_s.downcase.include?('m²') || product['unit'].to_s.downcase.include?('m2') ? o[:area] : 1
        row = grouped[product['id']]
        row[:quantity] += qty
        row[:unit] = product['unit']
        row[:productId] = product['id']
        row[:name] = product['name']
        row[:unitPrice] = product['refPrice'].to_f
      end
      { rows: grouped.values, unmatchedCount: unmatched }
    end
  end
end
