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

    // ==========================================
    // 6. 🎥 방송 & 미디어 (Media & Studio)
    // ==========================================
    "방송국": "Media_NewsDesk.jpg",
    "뉴스": "Media_NewsDesk.jpg",
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
