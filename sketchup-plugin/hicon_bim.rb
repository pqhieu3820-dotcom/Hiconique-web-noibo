# encoding: UTF-8
# HICON-BIM — plugin SketchUp đọc model, bóc tách khối lượng theo tag chuẩn
# 5D+ (IFC Class/Level/Room-Space/Material) và đồng bộ 2 chiều với trang
# HICON-BIM trên hiconique-noibo (Google Sheet qua Apps Script Web App).
# Xem sketchup-plugin/README.md để cài đặt & đóng gói .rbz.
require 'sketchup.rb'
require 'extensions.rb'

module HiconBim
  PLUGIN_ROOT = File.dirname(__FILE__).freeze

  ext = SketchupExtension.new('HICON-BIM', File.join(PLUGIN_ROOT, 'hicon_bim', 'main.rb'))
  ext.description = 'Đọc model SketchUp, bóc tách khối lượng theo tag/IFC/Level/Room, đồng bộ với HICONIQUE Nội bộ.'
  ext.version = '0.1.0'
  ext.creator = 'HICONIQUE'
  ext.copyright = '2026 HICONIQUE'
  Sketchup.register_extension(ext, true)
end
