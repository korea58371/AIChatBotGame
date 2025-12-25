import os
import re

# Define paths
BG_DIR = r"j:\AI\Game\AIChatBotGame\public\assets\god_bless_you\backgrounds"

# Translation Dictionaries
CATEGORY_MAP = {
    "Home": "집",
    "City": "도시",
    "Store": "상점",
    "Academy": "학교",
    "School": "학교",
    "Dungeon": "던전",
    "Facility": "시설",
    "Luxury": "고급",
    "Media": "방송",
    "Trans": "이동",
    "Place": "장소",
    "Indoor": "실내",
    "Ent": "여가",
    "Building": "건물",
    "Hospital": "병원",
    "Fantasy": "판타지",
}

DETAIL_MAP = {
    # Home
    "Basement": "반지하",
    "Attic": "다락방",
    "ShareHouse": "쉐어하우스",
    "Balcony": "발코니",
    "Bathroom": "욕실",
    "Hanok": "한옥",
    "Entrance": "현관",
    # City
    "Street": "거리",
    "Alley": "골목",
    "Downtown": "번화가",
    "FoodStall": "포장마차",
    "Underpass": "굴다리",
    "EmptyLot": "공터",
    "BusStop": "버스정류장",
    "Park": "공원",
    "Riverside": "강변",
    "Playground": "놀이터",
    "Slum": "빈민가",
    "GlampingSite": "글램핑장",
    "Tunnel": "터널",
    "Cafe": "카페",
    "Cozy": "아늑한",
    # Store
    "Convenience": "편의점",
    "Bookstore": "서점",
    "Market": "시장",
    "Laundromat": "빨래방",
    "Blacksmith": "대장간",
    "Workshop": "작업실",
    "Counter": "카운터",
    "Inside": "내부",
    # Dungeon/Fantasy
    "Cave": "동굴",
    "GlowingLake": "빛나는호수",
    "Rift": "균열",
    "Gwanghwamun": "광화문",
    "Volcano": "화산",
    "Field": "들판",
    "Desert": "사막",
    "Forest": "숲",
    "Poison": "독",
    "Ice": "얼음",
    "Niflheim": "니플헤임",
    "Flooded": "침수된",
    "Subway": "지하철",
    "Ruined": "폐허",
    "Mirror": "거울",
    "Room": "방",
    "Garden": "정원",
    "Sky": "공중",
    "Corridor": "복도",
    "Shadow": "그림자",
    "Zone": "구역",
    "ZeroGravity": "무중력",
    "Library": "도서관",
    "Infinite": "무한",
    "Silence": "침묵",
    "Maze": "미로",
    "Crystal": "수정",
    "Casino": "카지노",
    "Dark": "어둠",
    "BossRoom": "보스방",
    "RewardRoom": "보상방",
    "Ruins": "유적",
    "Cathedral": "대성당",
    "ClockTower": "시계탑",
    "ShoppingMall": "쇼핑몰",
    "SporeForest": "포자숲",
    "Giant": "거대",
    "Repair": "수리",
    # Facility
    "GuildHouse": "길드",
    "Lobby": "로비",
    "MasterOffice": "길드장실",
    "MeetingRoom": "회의실",
    "Lounge": "휴게실",
    "MasterRoom": "길드장개인실",
    "Admin": "관리국",
    "Registration": "접수처",
    "TrainingGround": "훈련장",
    "National": "국가",
    "Warehouse": "창고",
    "Freezer": "냉동",
    "Storage": "보관소",
    "CombatGear": "장비",
    "Rooftop": "옥상",
    "MachineRoom": "기계실",
    "Vent": "환풍구",
    "Monster": "몬스터",
    "Butcher": "해체장",
    "HyperbaricChamber": "고압산소실",
    "IsolationRoom": "격리실",
    "ConstructionSite": "공사장",
    "Wash": "세탁",
    "Port": "항구",
    "Terminal": "터미널",
    "Lab": "연구소",
    "Abandoned": "폐기된",
    "Interrogation": "취조실",
    "SewagePlant": "하수처리장",
    # Luxury
    "Hotel": "호텔",
    "LoveHotel": "러브호텔",
    "Secret": "비밀",
    "Spa": "스파",
    "HotSpring": "온천",
    "Resort": "리조트",
    "Pool": "수영장",
    "Cruise": "크루즈",
    "Deck": "갑판",
    "Royal": "로얄",
    "Opera": "오페라",
    "VIP": "VIP",
    "Salon": "살롱",
    "Hair": "미용실",
    "Shop": "샵",
    "FittingRoom": "피팅룸",
    "Bar": "바",
    "LP": "LP",
    "VinylPub": "바이닐펍",
    "Club": "클럽",
    "MasqueradeBall": "가면무도회",
    "Island": "섬",
    "Yacht": "요트",
    # Media
    "NewsDesk": "뉴스데스크",
    "PersonalStudio": "개인스튜디오",
    "Radio": "라디오",
    "Booth": "부스",
    "RecordingBooth": "녹음부스",
    "Dressing": "분장실",
    "Waiting": "대기실",
    "Set": "세트장",
    "MV": "뮤비",
    "PressConference": "기자회견장",
    "Awards": "시상식",
    "Stage": "무대",
    "Event": "이벤트",
    "FanSign": "팬사인회",
    "Studio": "스튜디오",
    "Chroma": "크로마키",
    "Photo": "포토",
    "VirtualCommunity": "가상공간",
    # Trans
    "Airport": "공항",
    "Runway": "활주로",
    "PrivateJet": "전용기",
    "Car": "차",
    "Limousine": "리무진",
    "DriveRoad": "도로주행",
    "Submarine": "잠수함",
    "Small": "소형",
    "Heliport": "헬기장",
    "CableCar": "케이블카",
    "Wyvern": "와이번",
    "Train": "기차",
    "VipRoom": "VIP실",
    "Parking": "주차",
    "Lot": "장",
    "Booth": "부스",
    "Plane": "비행기",
    "RestArea": "휴게소",
    "Midnight": "심야",
    "Subway": "지하철",
    "Locker": "보관함",
    # Place
    "DriveIn": "자동차",
    "Theater": "극장",
    "Fountain": "분수대",
    "Wish": "소원",
    "LostAndFound": "분실물센터",
    "TarotCafe": "타로카페",
    "Museum": "박물관",
    "BodyProfile": "바디프로필",
    "Aquarium": "아쿠아리움",
    "Botanical": "식물원",
    "Cabin": "산장",
    "CapsuleHotel": "캡슐호텔",
    "CarWash": "세차장",
    "Riding": "라이딩",
    "Ryokan": "료칸",
    # Indoor/Building
    "Kitchen": "주방",
    "Open": "오픈",
    "Pantry": "팬트리",
    "Storage": "창고",
    "DressRoom": "드레스룸",
    "Restroom": "화장실",
    "HighRise": "고층",
    "Error": "오류",
    "WaterTank": "물탱크",
    "Emergency": "비상",
    "Stairs": "계단",
    "Old": "낡은",
    # School
    "Gate": "정문",
    "Main": "메인",
    "ClubRoom": "동아리방",
    "Messy": "지저분한",
    "Festival": "축제",
    # Common Suffixes
    "Day": "", # Empty for day
    "Night": "밤",
    "Rain": "비",
    "Sunset": "노을",
    "Snow": "눈",
    "Traditional": "전통",
}


def translate_part(part):
    return DETAIL_MAP.get(part, part) # Return original if not found (fallback)

def generate_korean_key(filename):
    name_without_ext = os.path.splitext(filename)[0]
    parts = name_without_ext.split('_')
    
    if not parts:
        return name_without_ext

    # 1. Category
    category_en = parts[0]
    category_ko = CATEGORY_MAP.get(category_en, category_en)
    
    # 2. Details
    details_ko = []
    
    # Special handling for "Day" removal if it's implicitly default
    # but some files might be School_Library.jpg (no Day/Night).
    
    for part in parts[1:]:
        if part == "Day":
            continue # Skip 'Day' suffix
        
        translated = translate_part(part)
        details_ko.append(translated)
        
    # Construct Key
    full_key = f"{category_ko}"
    if details_ko:
        full_key += "_" + "_".join(details_ko)
        
    return full_key

def main():
    if not os.path.exists(BG_DIR):
        print(f"Error: Directory not found: {BG_DIR}")
        return

    files = sorted([f for f in os.listdir(BG_DIR) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
    
    mapping_entries = []
    
    target_file = r"j:\AI\Game\AIChatBotGame\src\data\games\god_bless_you\backgroundMappings.ts"
    with open(target_file, "w", encoding="utf-8") as f:
        f.write("export const backgroundMappings: Record<string, string> = {\n")
        
        current_category = ""
        
        for filename in files:
            key = generate_korean_key(filename)
            
            # Grouping logic for output readability
            category = key.split('_')[0]
            if category != current_category:
                f.write(f"\n    // {category} -------------------------\n")
                current_category = category
                
            f.write(f"    '{key}': '{filename}',\n")
            
        f.write("};\n")
    print(f"Successfully wrote to {target_file}")

if __name__ == "__main__":
    main()
