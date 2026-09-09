# encoding: UTF-8
module HiconBim
  # Bảng tag/layer chuẩn — chép lại đúng danh sách Name/Description trong bộ
  # tag của plugin 5D+ (ảnh người dùng gửi 2026-09-09), để HICON-BIM đọc được
  # object đã gán tag theo quy chuẩn đó mà không cần đổi quy trình đang dùng.
  # Key = tên tag/layer trên SketchUp (đúng chữ hoa/thường + dấu chấm như
  # 5D+ đặt). Value = { vi: nhãn tiếng Việt, ifc: IFC 2x3 class nếu có tương
  # ứng rõ ràng (để trống/nil nếu 5D+ không map 1-1 sang IFC) }.
  TAG_TAXONOMY = {
    # ! INFORMATION
    '!annotation' => { vi: 'Ghi chú' }, '!contour' => { vi: 'Đường đồng mức' },
    '!dimension' => { vi: 'Kích thước' }, '!grid' => { vi: 'Lưới trục' },
    '!label' => { vi: 'Tên nhãn' }, '!sign' => { vi: 'Ký hiệu' },
    '!space' => { vi: 'Không gian', ifc: 'IfcSpace' }, '!zone' => { vi: 'Khu vực', ifc: 'IfcZone' },
    '!opening' => { vi: 'Lỗ mở', ifc: 'IfcOpeningElement' },
    # # BASIC
    '#2d_graphic' => { vi: 'Đồ họa 2 chiều' }, '#3d_object' => { vi: 'Vật thể 3 chiều' },
    '#hidden' => { vi: 'Vật thể ẩn' }, '#proxy' => { vi: 'Vật thể đại diện' },
    '#text' => { vi: 'Chữ' }, '#viewport' => { vi: 'Khung nhìn đồ họa' },
    # @ STATUS
    '@external' => { vi: 'Bên ngoài' }, '@internal' => { vi: 'Bên trong' },
    '@demolition' => { vi: 'Phá dỡ' }, '@existing' => { vi: 'Hiện trạng' },
    '@new' => { vi: 'Mới' }, '@reuse' => { vi: 'Dùng lại' }, '@temporary' => { vi: 'Tạm thời' },
    # 1. CONTEXT
    '1. GEOGRAPHIC' => { vi: 'Cảnh quan địa lý' }, '1. ANIMAL' => { vi: 'Động vật' },
    '1. HUMAN' => { vi: 'Con người' }, '1. VEGETATION' => { vi: 'Thực vật' },
    '1. VEHICLE' => { vi: 'Phương tiện' },
    # 2. SITE
    '2. BUILDING' => { vi: 'Công trình xây dựng', ifc: 'IfcBuilding' },
    '2. PROPERTY' => { vi: 'Ranh giới đất' }, '2. SETBACK' => { vi: 'Khoảng lùi' },
    '2. SITE ELEMENT' => { vi: 'Cổng tường rào' },
    # A. ARCHITECTURAL
    'A. CHIMNEY' => { vi: 'Ống khói', ifc: 'IfcChimney' },
    'A. CURTAIN WALL' => { vi: 'Tường đứng', ifc: 'IfcCurtainWall' },
    'A. DOOR' => { vi: 'Cửa đi', ifc: 'IfcDoor' },
    'A. FINISHING CEILING' => { vi: 'Trần hoàn thiện', ifc: 'IfcCovering' },
    'A. FINISHING FLOOR' => { vi: 'Sàn hoàn thiện', ifc: 'IfcCovering' },
    'A. FINISHING WALL' => { vi: 'Tường hoàn thiện', ifc: 'IfcCovering' },
    'A. RAILING' => { vi: 'Lan can', ifc: 'IfcRailing' },
    'A. RAMP' => { vi: 'Đường dốc', ifc: 'IfcRamp' },
    'A. RAMP FLIGHT' => { vi: 'Phân đoạn đường dốc', ifc: 'IfcRampFlight' },
    'A. ROOF' => { vi: 'Mái công trình', ifc: 'IfcRoof' },
    'A. SHADING' => { vi: 'Cấu kiện che nắng', ifc: 'IfcShadingDevice' },
    'A. STAIR' => { vi: 'Cầu thang bộ', ifc: 'IfcStair' },
    'A. STAIR FLIGHT' => { vi: 'Phân đoạn thang', ifc: 'IfcStairFlight' },
    'A. WALL' => { vi: 'Tường', ifc: 'IfcWall' },
    'A. WINDOW' => { vi: 'Cửa sổ', ifc: 'IfcWindow' },
    # I. INTERIOR
    'I. FURNITURE' => { vi: 'Vật dụng nội thất', ifc: 'IfcFurniture' },
    'I. DECORATION' => { vi: 'Đồ trang trí nội thất' },
    'I. COVERING' => { vi: 'Hoàn thiện nội thất', ifc: 'IfcCovering' },
    'I. PARTITION' => { vi: 'Vách ngăn nội thất', ifc: 'IfcWall' },
    'I. EQUIPMENT' => { vi: 'Thiết bị nội thất' },
    # E. ELECTRICAL
    'E. CABLE CARRIER FITTING' => { vi: 'Khớp nối thang máng cáp', ifc: 'IfcCableCarrierFitting' },
    'E. CABLE CARRIER SEGMENT' => { vi: 'Đoạn thang máng cáp', ifc: 'IfcCableCarrierSegment' },
    'E. CABLE FITTING' => { vi: 'Khớp nối cáp', ifc: 'IfcCableFitting' },
    'E. CABLE SEGMENT' => { vi: 'Đoạn cáp', ifc: 'IfcCableSegment' },
    'E. ELECTRIC DISTRIBUTION BOARD' => { vi: 'Bảng điện', ifc: 'IfcElectricDistributionBoard' },
    'E. ELECTRIC FLOW STORAGE' => { vi: 'Bộ lưu điện', ifc: 'IfcElectricFlowStorageDevice' },
    'E. ELECTRIC GENERATOR' => { vi: 'Máy phát điện', ifc: 'IfcElectricGenerator' },
    'E. ELECTRIC MOTOR' => { vi: 'Mô tơ điện', ifc: 'IfcElectricMotor' },
    'E. ELECTRIC TIME CONTROL' => { vi: 'Bộ điều khiển định giờ', ifc: 'IfcElectricTimeControl' },
    'E. JUNCTION BOX' => { vi: 'Hộp nối điện', ifc: 'IfcJunctionBox' },
    'E. LIGHT FIXTURE' => { vi: 'Đèn được điều khiển chung', ifc: 'IfcLightFixture' },
    'E. PROTECTIVE DEVICE' => { vi: 'Thiết bị bảo vệ điện', ifc: 'IfcProtectiveDevice' },
    'E. TRANSFORMER' => { vi: 'Máy biến áp', ifc: 'IfcTransformer' },
    'E. TRIPPING UNIT' => { vi: 'Thiết bị ngắt mạch' },
    # F. FIRE PROTECTION
    'F. FIRE SUPPRESSION' => { vi: 'Hệ thống dập lửa', ifc: 'IfcFireSuppressionTerminal' },
    # M. MECHANICAL
    'M. ACTUATOR' => { vi: 'Bộ truyền động', ifc: 'IfcActuator' },
    'M. AIR TERMINAL' => { vi: 'Thiết bị điều hòa không khí', ifc: 'IfcAirTerminal' },
    'M. AIR TERMINAL BOX' => { vi: 'Hộp chia gió', ifc: 'IfcAirTerminalBox' },
    'M. AIR TO AIR HEAT RECOVERY' => { vi: 'Thiết bị thu hồi nhiệt', ifc: 'IfcAirToAirHeatRecovery' },
    'M. BOILER' => { vi: 'Nồi hơi', ifc: 'IfcBoiler' },
    'M. CHILLER' => { vi: 'Dàn lạnh', ifc: 'IfcChiller' },
    'M. COIL' => { vi: 'Bộ gia nhiệt', ifc: 'IfcCoil' },
    'M. COMPRESSOR' => { vi: 'Thiết bị nén chất lỏng', ifc: 'IfcCompressor' },
    'M. CONDENSER' => { vi: 'Thiết bị ngưng tụ', ifc: 'IfcCondenser' },
    'M. COOLED BEAM' => { vi: 'Thiết bị giải nhiệt', ifc: 'IfcCooledBeam' },
    'M. COOLING TOWER' => { vi: 'Tháp giải nhiệt', ifc: 'IfcCoolingTower' },
    'M. DAMPER' => { vi: 'Van chỉnh', ifc: 'IfcDamper' },
    'M. DUCT FITTING' => { vi: 'Khớp nối ống gió', ifc: 'IfcDuctFitting' },
    'M. DUCT SEGMENT' => { vi: 'Đoạn ống gió', ifc: 'IfcDuctSegment' },
    'M. DUCT SILENCER' => { vi: 'Tiêu âm ống gió', ifc: 'IfcDuctSilencer' },
    'M. ENGINE' => { vi: 'Động cơ', ifc: 'IfcEngine' },
    'M. EVAPORATIVE COOLER' => { vi: 'Máy làm mát bằng hơi nước', ifc: 'IfcEvaporativeCooler' },
    'M. EVAPORATOR' => { vi: 'Thiết bị làm bay hơi', ifc: 'IfcEvaporator' },
    'M. FILTER' => { vi: 'Thiết bị lọc', ifc: 'IfcFilter' },
    'M. HEAT EXCHANGER' => { vi: 'Bộ trao đổi nhiệt', ifc: 'IfcHeatExchanger' },
    'M. HUMIDIFIER' => { vi: 'Thiết bị tạo ẩm', ifc: 'IfcHumidifier' },
    'M. MOTOR CONNECTION' => { vi: 'Kết nối mô tơ' },
    'M. TUBE BUNDLE' => { vi: 'Bộ ống dẫn môi chất lạnh', ifc: 'IfcTubeBundle' },
    'M. VIBRATION ISOLATOR' => { vi: 'Bộ giảm chấn', ifc: 'IfcVibrationIsolator' },
    # P. PLUMBING
    'P. DISTRIBUTION CHAMBER' => { vi: 'Hố ga phân phối', ifc: 'IfcDistributionChamberElement' },
    'P. FLOW INSTRUMENT' => { vi: 'Bộ đo lưu lượng dòng chảy', ifc: 'IfcFlowInstrument' },
    'P. FLOW METER' => { vi: 'Đồng hồ đo dòng chảy', ifc: 'IfcFlowMeter' },
    'P. INTERCEPTOR' => { vi: 'Thiết bị lọc tách', ifc: 'IfcInterceptor' },
    'P. PIPE FITTING' => { vi: 'Khớp nối ống', ifc: 'IfcPipeFitting' },
    'P. PIPE SEGMENT' => { vi: 'Đoạn ống', ifc: 'IfcPipeSegment' },
    'P. PUMP' => { vi: 'Bơm', ifc: 'IfcPump' },
    'P. VALVE' => { vi: 'Van', ifc: 'IfcValve' },
    'P. WASTE TERMINAL' => { vi: 'Bể xử lý nước thải', ifc: 'IfcWasteTerminal' },
    # L. LANDSCAPE
    'L. HARDSCAPE' => { vi: 'Cảnh quan nhân tạo' }, 'L. SOFTSCAPE' => { vi: 'Cảnh quan sinh học' },
    'L. TOPOGRAPHY' => { vi: 'Cảnh quan địa hình', ifc: 'IfcGeographicElement' },
    'L. WATER FEATURE' => { vi: 'Cảnh quan mặt nước' }, 'L. LAWN' => { vi: 'Thảm cỏ' },
    'L. SHRUB' => { vi: 'Cây bụi' }, 'L. TREE' => { vi: 'Cây xanh' }, 'L. WALKWAY' => { vi: 'Đường dạo bộ' },
    # Q. EQUIPMENT
    'Q. ACCESSORY' => { vi: 'Phụ kiện thiết bị' }, 'Q. ALARM' => { vi: 'Chuông báo', ifc: 'IfcAlarm' },
    'Q. AUDIO VISUAL APPLIANCE' => { vi: 'Thiết bị nghe nhìn', ifc: 'IfcAudioVisualAppliance' },
    'Q. BURNER' => { vi: 'Thiết bị đốt', ifc: 'IfcBurner' },
    'Q. COMMUNICATIONS APPLIANCE' => { vi: 'Thiết bị viễn thông', ifc: 'IfcCommunicationsAppliance' },
    'Q. CONTROLLER' => { vi: 'Thiết bị điều khiển', ifc: 'IfcController' },
    'Q. ELECTRIC APPLIANCE' => { vi: 'Thiết bị điện gia dụng', ifc: 'IfcElectricAppliance' },
    'Q. FAN' => { vi: 'Quạt', ifc: 'IfcFan' }, 'Q. FASTENER' => { vi: 'Liên kết', ifc: 'IfcFastener' },
    'Q. FURNITURE' => { vi: 'Vật dụng', ifc: 'IfcFurniture' },
    'Q. FURNITURE ELEMENT' => { vi: 'Thành phần vật dụng', ifc: 'IfcFurnishingElement' },
    'Q. LAMP' => { vi: 'Bóng đèn', ifc: 'IfcLamp' },
    'Q. MECHANICAL FASTENER' => { vi: 'Liên kết cơ khí', ifc: 'IfcMechanicalFastener' },
    'Q. MEDICAL DEVICE' => { vi: 'Thiết bị y tế', ifc: 'IfcMedicalDevice' },
    'Q. OUTLET' => { vi: 'Ổ cắm', ifc: 'IfcOutlet' },
    'Q. SANITARY' => { vi: 'Thiết bị vệ sinh', ifc: 'IfcSanitaryTerminal' },
    'Q. SENSOR' => { vi: 'Thiết bị cảm biến', ifc: 'IfcSensor' },
    'Q. SOLAR DEVICE' => { vi: 'Thiết bị năng lượng mặt trời', ifc: 'IfcSolarDevice' },
    'Q. SPACE HEATER' => { vi: 'Thiết bị sưởi', ifc: 'IfcSpaceHeater' },
    'Q. STACK' => { vi: 'Thiết bị che chắn', ifc: 'IfcStackTerminal' },
    'Q. SWITCH' => { vi: 'Công tắc', ifc: 'IfcSwitchingDevice' },
    'Q. TANK' => { vi: 'Bể chứa', ifc: 'IfcTank' },
    'Q. TRANSPORT ELEMENT' => { vi: 'Thiết bị vận chuyển', ifc: 'IfcTransportElement' },
    'Q. UNITARY CONTROL ELEMENT' => { vi: 'Bộ điều khiển', ifc: 'IfcUnitaryControlElement' },
    'Q. UNITARY EQUIPMENT' => { vi: 'Bộ thiết bị', ifc: 'IfcUnitaryEquipment' },
    # S. STRUCTURAL
    'S. BEAM' => { vi: 'Dầm', ifc: 'IfcBeam' }, 'S. COLUMN' => { vi: 'Cột', ifc: 'IfcColumn' },
    'S. FOOTING' => { vi: 'Móng', ifc: 'IfcFooting' }, 'S. MEMBER' => { vi: 'Giằng', ifc: 'IfcMember' },
    'S. PILE' => { vi: 'Cọc', ifc: 'IfcPile' }, 'S. PLATE' => { vi: 'Bản thép', ifc: 'IfcPlate' },
    'S. REINFORCING BAR' => { vi: 'Thanh thép chịu lực', ifc: 'IfcReinforcingBar' },
    'S. REINFORCING MESH' => { vi: 'Lưới thép chịu lực', ifc: 'IfcReinforcingMesh' },
    'S. SLAB' => { vi: 'Bản sàn', ifc: 'IfcSlab' }, 'S. TENDON' => { vi: 'Cáp', ifc: 'IfcTendon' },
    'S. TENDON ANCHOR' => { vi: 'Neo cáp', ifc: 'IfcTendonAnchor' },
    # C. CIVIL
    'C. BRIDGE' => { vi: 'Cầu', ifc: 'IfcBridge' }, 'C. BUILDINGS' => { vi: 'Công trình', ifc: 'IfcBuilding' },
    'C. DAM' => { vi: 'Đê đập' }, 'C. DRAIN' => { vi: 'Mương cống thoát nước' },
    'C. LANDUSE 1' => { vi: 'Loại đất 1' }, 'C. LANDUSE 2' => { vi: 'Loại đất 2' },
    'C. MOAT' => { vi: 'Hào nước' }, 'C. POWER SUPPLY' => { vi: 'Hạ tầng cấp điện' },
    'C. RAILWAY' => { vi: 'Đường sắt', ifc: 'IfcRail' }, 'C. ROAD' => { vi: 'Đường bộ', ifc: 'IfcRoad' },
    'C. SIDEWALK' => { vi: 'Vỉa hè' }, 'C. TELECOMMUNICATION' => { vi: 'Hạ tầng viễn thông' },
    'C. TRAIL' => { vi: 'Đường mòn' }, 'C. TUNNEL' => { vi: 'Đường hầm', ifc: 'IfcTunnel' },
    'C. WATER SUPPLY' => { vi: 'Hạ tầng cấp nước' }, 'C. WATER WASTE' => { vi: 'Hạ tầng thoát nước thải' },
    # @REFERENCES
    'Reference: Skp' => { vi: 'SketchUp tham chiếu' }, 'Reference: Cad' => { vi: 'Cad tham chiếu' },
    'Reference: Image' => { vi: 'Ảnh tham chiếu' }
  }.freeze

  # #MATERIALS — mã vật liệu 5D+ (m_xxx) -> nhãn tiếng Việt, dùng để gợi ý
  # tên khi material trong SketchUp đặt đúng theo quy ước này.
  MATERIAL_TAXONOMY = {
    'm_brick#1' => 'Vật liệu gạch xây #1', 'm_brick#2' => 'Vật liệu gạch xây #2',
    'm_ceiling' => 'Vật liệu hoàn thiện trần', 'm_ceramic' => 'Vật liệu gốm',
    'm_cladding' => 'Vật liệu ốp tường', 'm_concrete#1' => 'Vật liệu bê tông #1',
    'm_concrete#2' => 'Vật liệu bê tông #2', 'm_earth' => 'Vật liệu đất',
    'm_fabric' => 'Vật liệu vải', 'm_fill' => 'Vật liệu bồi đắp',
    'm_flooring' => 'Vật liệu hoàn thiện sàn', 'm_frame' => 'Vật liệu hệ khung',
    'm_glass' => 'Vật liệu kính', 'm_gypsum' => 'Vật liệu thạch cao',
    'm_insulation' => 'Vật liệu cách ly', 'm_metal' => 'Vật liệu kim loại',
    'm_others' => 'Vật liệu khác', 'm_plastic' => 'Vật liệu nhựa',
    'm_rhs' => 'Vật liệu thép hình rỗng', 'm_roofing' => 'Vật liệu hoàn thiện mái',
    'm_sand' => 'Vật liệu cát', 'm_screed' => 'Vật liệu vữa', 'm_stone' => 'Vật liệu đá',
    'm_water' => 'Vật liệu nước', 'm_wood' => 'Vật liệu gỗ'
  }.freeze

  # Tra tag/layer -> { vi:, ifc: } không phân biệt hoa/thường, khớp cả khi
  # tên layer thật trên model có thêm số thứ tự phía sau (VD "A. WALL#1").
  def self.lookup_tag(layer_name)
    return nil unless layer_name
    exact = TAG_TAXONOMY[layer_name]
    return exact if exact
    key = TAG_TAXONOMY.keys.find { |k| layer_name.strip.downcase.start_with?(k.strip.downcase) }
    key ? TAG_TAXONOMY[key] : nil
  end

  def self.lookup_material(material_name)
    return nil unless material_name
    MATERIAL_TAXONOMY[material_name.strip.downcase]
  end
end
