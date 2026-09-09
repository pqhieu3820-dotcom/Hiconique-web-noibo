# encoding: UTF-8
require_relative 'constants'

module HiconBim
  # Đọc model SketchUp thật qua SketchUp Ruby API — không có dữ liệu giả nào
  # ở đây, mọi số liệu lấy trực tiếp từ Entity/BoundingBox/Face thật của
  # model đang mở. Đơn vị nội bộ SketchUp là inch — quy hết ra mét/mét
  # vuông/mét khối trước khi trả về, để khớp đơn vị đang dùng trên web.
  module Scanner
    IN_TO_M = 0.0254
    IN2_TO_M2 = IN_TO_M**2
    IN3_TO_M3 = IN_TO_M**3

    # Duyệt đệ quy mọi Group/ComponentInstance trong model (kể cả lồng
    # nhau) — mỗi cái là 1 "object" theo đúng khái niệm 5D+/MoBim. Không đi
    # vào bên trong 1 component bị ẩn (visible? == false) trừ khi include_hidden.
    def self.each_object(entities = Sketchup.active_model.entities, include_hidden: false, &block)
      entities.each do |e|
        next if !include_hidden && !e.visible?
        case e
        when Sketchup::Group, Sketchup::ComponentInstance
          block.call(e)
          inner = inner_entities(e)
          each_object(inner, include_hidden: include_hidden, &block) if inner
        end
      end
    end

    def self.inner_entities(e)
      if e.is_a?(Sketchup::ComponentInstance)
        e.definition.entities
      elsif e.is_a?(Sketchup::Group)
        e.entities
      end
    end
    private_class_method :inner_entities

    def self.definition_of(e)
      e.is_a?(Sketchup::ComponentInstance) ? e.definition : e.definition
    rescue StandardError
      nil
    end
    private_class_method :definition_of

    # Best-effort đọc IFC Classification gán sẵn trên object (SketchUp hỗ
    # trợ gán IFC 2x3 native qua Window > Model Info > Classifications).
    # Bọc rescue vì API .classifications thay đổi tuỳ bản SketchUp — không
    # để lỗi đọc IFC làm hỏng cả lượt scan.
    def self.native_ifc_class(e)
      return nil unless e.respond_to?(:classifications)
      schema = e.classifications['IFC 2x3'] || e.classifications['IFC2X3'] || e.classifications['IFC4']
      return nil unless schema
      schema['IfcExportAs'] || schema['ifc_entity_type'] || schema.to_s
    rescue StandardError
      nil
    end
    private_class_method :native_ifc_class

    # Quét toàn bộ Object (Group/Component instance) — trả về Array<Hash>,
    # mỗi Hash tương ứng 1 dòng "Object BIM" sẽ gửi lên qua syncBimObjects.
    def self.scan_objects(levels: [])
      model = Sketchup.active_model
      out = []
      each_object(model.entities) do |e|
        defn = definition_of(e)
        next unless defn
        tag_name = e.layer ? e.layer.name : ''
        taxonomy = HiconBim.lookup_tag(tag_name)
        bounds = e.bounds
        width_m = (bounds.width * IN_TO_M).round(3)
        height_m = (bounds.height * IN_TO_M).round(3)
        depth_m = (bounds.depth * IN_TO_M).round(3)
        z_center_m = ((bounds.min.z + bounds.max.z) / 2.0 * IN_TO_M).round(3)

        own_entities = inner_entities(e)
        area_m2 = own_entities ? own_entities.grep(Sketchup::Face).sum { |f| f.area * IN2_TO_M2 }.round(3) : 0
        volume_m3 = begin
          e.respond_to?(:volume) ? (e.volume.to_f * IN3_TO_M3).round(4) : 0
        rescue StandardError
          0
        end

        material_name = e.material ? e.material.name : nil
        instance_count = begin
          defn.count_used_instances
        rescue StandardError
          1
        end

        out << {
          elementGuid: e.persistent_id.to_s,
          defName: (e.is_a?(Sketchup::ComponentInstance) ? defn.name : (e.name && !e.name.empty? ? e.name : defn.name)),
          tagName: tag_name,
          group: taxonomy ? taxonomy[:vi] : '',
          ifcClass: native_ifc_class(e) || (taxonomy ? taxonomy[:ifc] : nil),
          materialName: material_name,
          level: assign_level(z_center_m, levels),
          space: nil, # gán ở merge_spaces_into_objects, không tính ở đây
          width: width_m, height: height_m, depth: depth_m,
          area: area_m2, volume: volume_m3,
          instanceCount: instance_count
        }
      end
      out
    end

    # "!space" theo tag chuẩn 5D+ — 1 Face nằm trực tiếp trên layer đó (không
    # cần group riêng, đúng như "Space lưu đúng occurrence của face, boundary
    # polygon" trong ảnh người dùng gửi) được tính là 1 phòng/không gian.
    def self.scan_spaces
      model = Sketchup.active_model
      spaces = []
      idx = 0
      visit = lambda do |entities|
        entities.each do |e|
          case e
          when Sketchup::Face
            layer_name = e.layer ? e.layer.name : ''
            next unless layer_name.strip.downcase.start_with?('!space')
            idx += 1
            bounds = e.bounds
            spaces << {
              name: "Không gian #{idx}",
              area: (e.area * IN2_TO_M2).round(2),
              height: ((bounds.max.z - bounds.min.z) * IN_TO_M).round(2),
              elevation: (bounds.min.z * IN_TO_M).round(2)
            }
          when Sketchup::Group
            visit.call(e.entities)
          when Sketchup::ComponentInstance
            visit.call(e.definition.entities)
          end
        end
      end
      visit.call(model.entities)
      spaces
    end

    # Level do người dùng khai báo (tên + khoảng cao độ min/max, mét) — tự
    # gán cho object theo tâm bounding box Z. `levels` = Array<{name:,
    # elevationMin:, elevationMax:}>, khai báo/lưu trong dialog (xem
    # config lưu ở model attribute dictionary, không phải Sketchup.write_default
    # vì Level là dữ liệu RIÊNG của từng file .skp).
    def self.assign_level(z_center_m, levels)
      match = levels.find { |lv| z_center_m >= lv[:elevationMin].to_f && z_center_m < lv[:elevationMax].to_f }
      match ? match[:name] : nil
    end
    private_class_method :assign_level

    # Danh sách vật liệu THẬT đang dùng trong model (Sketchup::Materials),
    # kèm tổng diện tích mặt đang gán material đó — quét 1 lần toàn model,
    # không chỉ trong object đã tag, để không bỏ sót mặt chưa được nhóm vào
    # group/component nào.
    def self.scan_materials
      model = Sketchup.active_model
      usage = Hash.new(0.0)
      visit = lambda do |entities|
        entities.each do |e|
          case e
          when Sketchup::Face
            usage[e.material.name] += e.area * IN2_TO_M2 if e.material
            usage[e.back_material.name] += e.area * IN2_TO_M2 if e.back_material
          when Sketchup::Group
            visit.call(e.entities)
          when Sketchup::ComponentInstance
            visit.call(e.definition.entities)
          end
        end
      end
      visit.call(model.entities)

      model.materials.map do |m|
        taxonomy_label = HiconBim.lookup_material(m.name)
        {
          name: m.name,
          taxonomyLabel: taxonomy_label,
          areaM2: (usage[m.name] || 0).round(2)
        }
      end
    end

    def self.model_guid
      Sketchup.active_model.guid
    rescue StandardError
      nil
    end

    def self.model_file_name
      path = Sketchup.active_model.path
      path && !path.empty? ? File.basename(path) : Sketchup.active_model.title
    end
  end
end
