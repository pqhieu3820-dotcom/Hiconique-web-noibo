# encoding: UTF-8
require 'sketchup.rb'
require_relative 'dialog'

module HiconBim
  unless file_loaded?(__FILE__)
    menu = UI.menu('Extensions').add_submenu('HICON-BIM')
    menu.add_item('Mở HICON-BIM') { Dialog.show }

    toolbar = UI::Toolbar.new('HICON-BIM')
    cmd = UI::Command.new('HICON-BIM') { Dialog.show }
    cmd.tooltip = 'Mở HICON-BIM'
    cmd.status_bar_text = 'Đọc model và bóc tách khối lượng, đồng bộ với HICONIQUE Nội bộ'
    icon_path = File.join(__dir__, 'html', 'icon.png')
    if File.exist?(icon_path)
      cmd.small_icon = icon_path
      cmd.large_icon = icon_path
    end
    toolbar.add_item(cmd)
    toolbar.show

    file_loaded(__FILE__)
  end
end
