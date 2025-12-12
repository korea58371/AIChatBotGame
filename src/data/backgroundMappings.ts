export const backgroundMappings: Record<string, string> = {
    // [AI가 뱉을 키워드]: [실제 파일명]

    // ==========================================
    // 1. 🏠 주거 & 개인 공간 (Home & Private)
    // ==========================================
    "집": "Home_Basement_Day.jpg",
    "자취방": "Home_Basement_Day.jpg",
    "반지하": "Home_Basement_Day.jpg",
    "내방": "Home_Basement_Day.jpg",
    "다락방": "Home_Attic.jpg",
    "쉐어하우스": "Home_ShareHouse_Set.jpg",
    "베란다": "Home_Balcony.jpg",
    "발코니": "Home_Balcony.jpg",
    "비상계단": "Building_Stairs_Emergency.jpg",
    "옥상": "Building_Rooftop_Garden.jpg",
    "물탱크": "Building_Rooftop_WaterTank.jpg",
    "고급반지하": "Home_Basement_Luxury.jpg",
    "리모델링": "Home_Basement_Luxury.jpg",
    "반지하_밤": "Home_Basement_Night.jpg",
    "집_밤": "Home_Basement_Night.jpg",
    "화장실_반지하": "Home_Bathroom_Basement.jpg",
    "욕실": "Home_Bathroom_Basement.jpg",
    "한옥": "Home_Hanok_Traditional.jpg",
    "전통가옥": "Home_Hanok_Traditional.jpg",
    "드레스룸": "Indoor_DressRoom.jpg",
    "주방": "Indoor_Kitchen_Open.jpg",
    "팬트리": "Indoor_Room_Pantry.jpg",
    "창고": "Indoor_Room_Storage.jpg",

    // ==========================================
    // 2. 🏙️ 도시 & 일상 (City & Daily)
    // ==========================================
    "길거리": "City_Street.jpg",
    "골목": "City_BlackMarket_Alley.jpg",
    "번화가": "City_Downtown_Day.jpg",
    "포장마차": "City_Street_FoodStall.jpg",
    "공터": "City_Underpass_EmptyLot.jpg",
    "버스정류장": "City_BusStop_Day.jpg",
    "편의점": "Store_Convenience_Inside.jpg",
    "헌책방": "Store_Bookstore_Old.jpg",
    "시장": "Store_Market_Traditional.jpg",
    "빨래방": "Store_Laundromat.jpg",
    "폐건물": "City_AbandonedBuilding_Construction.jpg",
    "놀이터": "City_Playground_Old.jpg",
    "한강": "City_Park_Riverside_Night.jpg",
    "공원": "City_Park_Riverside_Night.jpg",
    "카페": "City_Cafe_Cozy_Day.jpg",
    "카페_밤": "City_Cafe_Cozy_Night.jpg",
    "글램핑": "City_GlampingSite.jpg",
    "캠핑장": "City_GlampingSite.jpg",
    "캠핑카": "Place_CampingCar.jpg",
    "버스정류장_비": "City_BusStop_Rain.jpg",
    "은행": "Place_Bank_Vault.jpg",
    "금고": "Place_Bank_Vault.jpg",
    "자동차극장": "Place_DriveIn_Theater.jpg",
    "분수대": "Place_Fountain_Wish.jpg",
    "분실물센터": "Place_LostAndFound.jpg",
    "타로카페": "Place_TarotCafe.jpg",
    "점집": "Place_TarotCafe.jpg",
    "박물관": "Place_Museum_Night.jpg",
    "전시회": "Place_Museum_Night.jpg",
    "바디프로필": "Place_Studio_BodyProfile.jpg",
    "수족관": "Place_Aquarium_Night.jpg",
    "아쿠아리움": "Place_Aquarium_Night.jpg",
    "식물원": "Place_Botanical_Rain.jpg",
    "산장": "Place_Cabin_Snow.jpg",
    "캡슐호텔": "Place_CapsuleHotel.jpg",

    // ==========================================
    // 3. ⚔️ 던전 & 판타지 (Dungeon & Fantasy)
    // ==========================================
    "던전": "Dungeon_Cave_GlowingLake.jpg", // Generic Dungeon
    "균열": "Dungeon_Gwanghwamun_Rift.jpg",
    "광화문": "Dungeon_Gwanghwamun_Rift.jpg",
    "화산": "Dungeon_Volcano_Field.jpg",
    "사막": "Dungeon_Desert_Day.jpg",
    "숲": "Dungeon_Forest_Poison.jpg",
    "설원": "Dungeon_Ice_Niflheim.jpg",
    "니플헤임": "Dungeon_Ice_Niflheim.jpg",
    "침수된도시": "Dungeon_Flooded_City.jpg",
    "강남역": "Dungeon_Flooded_City.jpg",
    "지하철터널": "Dungeon_Subway_Ruined.jpg",
    "폐병동": "Dungeon_Hospital_Ruined.jpg",
    "거울의방": "Dungeon_Mirror_Room.jpg",
    "공중정원": "Dungeon_Garden_Sky.jpg",
    "그림자회랑": "Dungeon_Corridor_Shadow.jpg",
    "무중력": "Dungeon_Zone_ZeroGravity.jpg",
    "도서관": "Dungeon_Library_Infinite.jpg",
    "수정미로": "Dungeon_Maze_Crystal.jpg",
    "카지노던전": "Dungeon_Casino_Dark.jpg",
    "동굴": "Dungeon_Cave_GlowingLake.jpg",
    "대성당": "Dungeon_Ruins_Cathedral.jpg",
    "대장간": "Store_Blacksmith_Workshop.jpg", // Updated to map to Store
    "정비소": "Fantasy_Repair_Room.jpg",
    "시계탑": "Dungeon_ClockTower_Inside.jpg",
    "폐백화점": "Dungeon_ShoppingMall_Ruined.jpg",
    "쇼핑몰_폐허": "Dungeon_ShoppingMall_Ruined.jpg",
    "침묵의도서관": "Dungeon_Library_Silence.jpg",
    "포자숲": "Dungeon_SporeForest_Giant.jpg",
    "사막_밤": "Dungeon_Desert_Night.jpg",
    "그리폰": "Trans_Mount_Griffon.jpg",
    "몬스터라이딩": "Place_Monster_Riding.jpg",

    // ==========================================
    // 4. 🏢 시설 & 기관 (Facility & Organization)
    // ==========================================
    "길드": "Facility_GuildHouse_Lobby.jpg",
    "길드로비": "Facility_GuildHouse_Lobby.jpg",
    "길드장실": "Facility_GuildHouse_MasterOffice.jpg", // Mapped to closest
    "회의실": "Facility_GuildHouse_MeetingRoom.jpg",
    "휴게실": "Facility_GuildHouse_Lounge.jpg",
    "관리국": "Facility_Admin_Registration.jpg",
    "사관학교": "Academy_Gate_Main.jpg",
    "훈련장": "Facility_TrainingGround_National.jpg",
    "병원": "Hospital_Room_VIP.jpg", // Generic Hospital
    "치료실": "Hospital_Room_Therapy.jpg",
    "냉동창고": "Facility_Warehouse_Freezer.jpg",
    "길드장개인실": "Facility_GuildHouse_MasterRoom.jpg",
    "마스터룸": "Facility_GuildHouse_MasterRoom.jpg",
    "장비창고": "Facility_Storage_CombatGear.jpg",
    "무기고": "Facility_Storage_CombatGear.jpg",
    "기계실": "Facility_Rooftop_MachineRoom.jpg",
    "환풍구": "Facility_Rooftop_Vent.jpg",
    "해체장": "Facility_Monster_Butcher.jpg",
    "정육점": "Facility_Monster_Butcher.jpg",
    "고압산소치료실": "Facility_HyperbaricChamber.jpg",
    "격리실": "Facility_IsolationRoom.jpg",
    "공사장": "Facility_ConstructionSite_Night.jpg",
    "공사장_낮": "Facility_ConstructionSite_Day.jpg",
    "공사장_노을": "Facility_ConstructionSite_Sunset.jpg",
    "세탁실": "Facility_Wash_Room.jpg",
    "항구": "Facility_Port_Terminal.jpg",
    "연구소": "Facility_Lab_Abandoned.jpg",
    "취조실": "Facility_Room_Interrogation.jpg",
    "도서관밤": "School_Library_Night.jpg",
    "동아리방": "School_ClubRoom_Messy.jpg",
    "축제": "School_Festival_Bar.jpg",
    "학교": "School_ClubRoom_Messy.jpg", // Fallback for School

    // ==========================================
    // 5. ✨ 럭셔리 & 유흥 (Luxury & Entertainment)
    // ==========================================
    "호텔": "Luxury_Hotel_Lobby.jpg",
    "로비": "Luxury_Hotel_Lobby.jpg",
    "라운지": "Luxury_Lounge_Secret.jpg",
    "스파": "Luxury_Spa.jpg",
    "온천": "Luxury_HotSpring_Snow.jpg",
    "수영장": "Luxury_Resort_Pool.jpg",
    "크루즈": "Luxury_Cruise_Deck.jpg",
    "카지노": "Luxury_Casino_Royal.jpg",
    "오페라": "Luxury_Opera_VIP.jpg",
    "미용실": "Luxury_Salon_Hair.jpg",
    "피팅룸": "Luxury_Shop_FittingRoom.jpg",
    "바": "Ent_Bar_LP.jpg",
    "클럽": "Luxury_VinylPub.jpg", // Fallback
    "노래방": "Ent_Room_Karaoke.jpg",
    "PC방": "Ent_Room_PC.jpg",
    "방탈출": "Ent_Cafe_RoomEscape.jpg",
    "볼링장": "Ent_Sports_Bowling.jpg",
    "골프장": "Ent_Sports_Golf_Night.jpg",
    "리조트": "Luxury_Resort_Island.jpg",
    "휴양지": "Luxury_Resort_Island.jpg",
    "요트": "Luxury_Resort_Yacht.jpg",
    "호텔입구": "Luxury_Hotel_Entrance.jpg",
    "가면무도회": "Luxury_MasqueradeBall.jpg",
    "파티": "Luxury_MasqueradeBall.jpg",
    "야구장": "Ent_Sports_Baseball.jpg",
    "클라이밍": "Ent_Sports_Climbing.jpg",
    "아이스링크": "Ent_Sports_IceLink.jpg",
    "테니스장": "Ent_Sports_Tennis.jpg",
    "요가": "Ent_Sports_Yoga.jpg",
    "료칸": "Place_Ryokan.jpg",
    "온천여관": "Place_Ryokan.jpg",
    "호텔화장실": "Indoor_Restroom_Hotel.jpg",
    "고급화장실": "Indoor_Restroom_Luxury.jpg",

    // ==========================================
    // 6. 🎥 방송 & 미디어 (Media & Studio)
    // ==========================================
    "방송국": "Media_NewsDesk.jpg",
    "뉴스": "Media_NewsDesk.jpg",
    "NewsStudio": "Media_NewsDesk.jpg",
    "스튜디오": "Media_PersonalStudio.jpg",
    "라디오": "Media_Radio_Booth.jpg",
    "촬영장": "Media_Set_MV.jpg",
    "대기실": "Media_Room_Waiting.jpg",
    "기자회견": "Media_PressConference.jpg",
    "시상식": "Media_Awards_Stage.jpg",
    "팬사인회": "Media_Event_FanSign.jpg",

    // ==========================================
    // 7. 🚆 교통 & 탈것 (Transport & Vehicle)
    // ==========================================
    "지하철": "Trans_Subway_Inside.jpg",
    "버스": "Trans_Bus_Inside.jpg",
    "공항": "Trans_Airport_Runway.jpg",
    "비행기": "Trans_PrivateJet.jpg",
    "리무진": "Trans_Car_Limousine.jpg",
    "차안": "Trans_Car_DriveRoad.jpg",
    "잠수함": "Trans_Submarine_Small.jpg",
    "헬기장": "Trans_Heliport.jpg",
    "케이블카": "Trans_CableCar.jpg",
    "와이번": "Trans_Monster_Wyvern.jpg",
    "기차VIP실": "Trans_Train_VipRoom.jpg",
    "주차장": "Trans_Parking_Lot.jpg",
    "주차정산소": "Trans_Parking_Booth.jpg",
    "버스_밤": "Trans_Bus_Inside_Night.jpg",
    "비행기화장실": "Trans_Plane_Restroom.jpg",

    // ==========================================
    // 8. 🚻 공용 공간 (Common & Restroom)
    // ==========================================
    "화장실": "Indoor_Restroom_Old.jpg",
    "엘리베이터": "Indoor_Elevator_HighRise.jpg",
    "휴게소": "Trans_RestArea_Midnight.jpg",
    "세차장": "Place_CarWash.jpg",

    // ==========================================
    // 9. ⚠️ Specific Fixes for AI Hallucinations
    // ==========================================
    // "Van_Interior_Night" is strictly NOT mapped to Bus here as per user request.
    // It will fall through to fuzzy search -> fail -> Default_Fallback.

    "City_Street_General": "City_Street.jpg", // Alias for AI consistency

    // ==========================================
    // 10. 🌏 Country Aliases (Mapping Foreign Keys to Shared Assets)
    // ==========================================
    "일본_편의점_밤": "Store_Convenience_Night.jpg",
    "일본_프리미엄 만화 카페": "Ent_Cafe_Comics.jpg",
    "일본_지하철 물품 보관함": "Trans_Subway_Locker.jpg",
    "일본_크로마키 촬영장": "Media_Studio_Chroma.jpg",
    "일본_고가도로 아래 공터": "City_Underpass_EmptyLot.jpg",
    "일본_길거리_번화가_밤": "City_Downtown_Night.jpg",
    "일본_셀프 포토 스튜디오": "Ent_Photo_Studio.jpg",
    "일본_코인 노래방": "Ent_Room_Karaoke.jpg",
    "일본_개인 방송 스튜디오": "Media_PersonalStudio.jpg",
};
