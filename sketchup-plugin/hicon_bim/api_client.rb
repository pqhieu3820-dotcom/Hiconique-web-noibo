# encoding: UTF-8
require 'net/http'
require 'uri'
require 'json'
require_relative 'config'

module HiconBim
  # Gọi thẳng Google Apps Script Web App (cùng API mà public/js/task-data.js
  # và gsheets-api-v2.js đang dùng) — mọi action đều là 1 request GET với
  # query string action=...&id=...&data=<JSON đã encode>, giống hệt quy ước
  # fetchFromAPI() phía web, để không cần thêm cơ chế auth/endpoint riêng.
  module ApiClient
    class ApiError < StandardError; end

    # Apps Script /exec URL trả về 302 sang script.googleusercontent.com —
    # Net::HTTP không tự follow redirect nên phải làm tay, tối đa 5 lần.
    def self.request(action, id: nil, data: nil)
      base = Config.api_url.to_s.strip
      raise ApiError, 'Chưa cấu hình API URL — mở Cài đặt trong plugin.' if base.empty?

      params = { 'action' => action }
      params['id'] = id if id
      params['data'] = JSON.generate(data) if data

      url = build_url(base, params)
      response = fetch_following_redirects(url)

      unless response.is_a?(Net::HTTPSuccess)
        raise ApiError, "HTTP #{response.code} khi gọi #{action}"
      end

      body = response.body.to_s
      parsed = JSON.parse(body) rescue nil
      raise ApiError, "Phản hồi không phải JSON hợp lệ cho #{action}" if parsed.nil?
      raise ApiError, parsed['error'].to_s if parsed.is_a?(Hash) && parsed['error']
      parsed
    end

    def self.build_url(base, params)
      query = params.map { |k, v| "#{k}=#{URI.encode_www_form_component(v)}" }.join('&')
      base.include?('?') ? "#{base}&#{query}" : "#{base}?#{query}"
    end
    private_class_method :build_url

    def self.fetch_following_redirects(url_str, limit = 5)
      raise ApiError, 'Quá nhiều lần chuyển hướng' if limit <= 0
      uri = URI.parse(url_str)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.open_timeout = 20
      http.read_timeout = 60
      response = http.get(uri.request_uri)
      case response
      when Net::HTTPRedirection
        fetch_following_redirects(response['location'], limit - 1)
      else
        response
      end
    end
    private_class_method :fetch_following_redirects

    # ---- Helpers dùng chung cho scanner/dialog — đặt tên action khớp đúng
    # gsheets-api-v2.js (bimProducts/bimBoqItems) và bim-model-sync.gs
    # (bimModels/bimObjects, xem file đó ở gốc repo).
    def self.get_products
      request('getBimProducts')
    end

    def self.get_models
      request('getBimModels')
    end

    def self.upsert_model(model_data)
      existing = get_models.find { |m| m['modelGuid'] == model_data[:modelGuid] }
      if existing
        request('updateBimModel', id: existing['id'], data: model_data)
        existing['id']
      else
        saved = request('addBimModel', data: model_data)
        saved['id']
      end
    end

    def self.sync_objects(model_id, objects, synced_by)
      request('syncBimObjects', data: { modelId: model_id, objects: objects, syncedBy: synced_by })
    end

    def self.get_boq_items(project_id)
      request('getBimBoqItems').select { |r| r['projectId'] == project_id }
    end

    def self.add_boq_item(item)
      request('addBimBoqItem', data: item)
    end

    def self.update_boq_item(id, item)
      request('updateBimBoqItem', id: id, data: item)
    end
  end
end
