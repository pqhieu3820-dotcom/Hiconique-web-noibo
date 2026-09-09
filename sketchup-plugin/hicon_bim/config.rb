# encoding: UTF-8
require 'sketchup.rb'

module HiconBim
  # Cấu hình plugin lưu bằng Sketchup.write_default/read_default — theo máy
  # người dùng (ổn định giữa các lần mở SketchUp), KHÔNG lưu trong file .skp.
  module Config
    SECTION = 'HiconBim'.freeze

    def self.api_url
      Sketchup.read_default(SECTION, 'api_url', '')
    end

    def self.api_url=(value)
      Sketchup.write_default(SECTION, 'api_url', value.to_s)
    end

    def self.project_id
      Sketchup.read_default(SECTION, 'project_id', '')
    end

    def self.project_id=(value)
      Sketchup.write_default(SECTION, 'project_id', value.to_s)
    end

    def self.project_name
      Sketchup.read_default(SECTION, 'project_name', '')
    end

    def self.project_name=(value)
      Sketchup.write_default(SECTION, 'project_name', value.to_s)
    end

    def self.member_name
      Sketchup.read_default(SECTION, 'member_name', '')
    end

    def self.member_name=(value)
      Sketchup.write_default(SECTION, 'member_name', value.to_s)
    end

    def self.configured?
      !api_url.to_s.strip.empty? && !project_id.to_s.strip.empty?
    end

    def self.to_h
      { apiUrl: api_url, projectId: project_id, projectName: project_name, memberName: member_name }
    end
  end
end
