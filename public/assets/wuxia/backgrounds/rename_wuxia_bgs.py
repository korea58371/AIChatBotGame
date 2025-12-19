
import os
import json
import sys

# Directory
DIR = "j:\\AI\\Game\\AIChatBotGame\\public\\assets\\wuxia\\backgrounds"

# Mapping: Korean Filename -> New English Filename
# Note: Keys are the filenames ON DISK (Korean). Values are the TARGET English filenames.
mapping = {
    "강호_갈대밭.jpg": "Jianghu_ReedField.jpg",
    "강호_계곡.jpg": "Jianghu_Valley.jpg",
    "강호_대나무숲.jpg": "Jianghu_BambooForest.jpg",
    "강호_동굴.jpg": "Jianghu_Cave.jpg",
    "강호_산길.jpg": "Jianghu_MountainPath.jpg",
    "강호_성벽.jpg": "Jianghu_Wall.jpg",
    "강호_숲길.jpg": "Jianghu_ForestPath.jpg",
    "강호_절벽위.jpg": "Jianghu_CliffTop.jpg",
    "강호_절벽위_밤.jpg": "Jianghu_CliffTop_Night.jpg",
    "객잔_1층.jpg": "Inn_FirstFloor.jpg",
    "객잔_객실.jpg": "Inn_GuestRoom.jpg",
    "객잔_마구간.jpg": "Inn_Stable.jpg",
    "객잔_부엌.jpg": "Inn_Kitchen.jpg",
    "객잔_특실.jpg": "Inn_Suite.jpg",
    "기루_기녀의방.jpg": "Brothel_CourtesanRoom.jpg",
    "기루_연회장.jpg": "Brothel_BanquetHall.jpg",
    "남궁세가_가주실.jpg": "Namgung_HeadOffice.jpg",
    "남궁세가_검총.jpg": "Namgung_SwordGrave.jpg",
    "남궁세가_남궁세아의방.jpg": "Namgung_SeahRoom.jpg",
    "남궁세가_대연무장.jpg": "Namgung_GreatTrainingHall.jpg",
    "남궁세가_연회장.jpg": "Namgung_BanquetHall.jpg",
    "남궁세가_정원.jpg": "Namgung_Garden.jpg",
    "남궁세가_창천각.jpg": "Namgung_BlueSkyPavilion.jpg",
    "모용세가_가주집무실.jpg": "Moyong_HeadOffice.jpg",
    "모용세가_모용예린방.jpg": "Moyong_YerinRoom.jpg",
    "모용세가_수상손님방.jpg": "Moyong_GuestRoomOnWater.jpg",
    "모용세가_연자오.jpg": "Moyong_Yeonjalake.jpg",
    "모용세가_장서각.jpg": "Moyong_Library.jpg",
    "모용세가_환검정.jpg": "Moyong_IllusionOnePavilion.jpg",
    "무당파_금정.jpg": "Wudang_GoldenTop.jpg",
    "무당파_빈객실.jpg": "Wudang_GuestRoom.jpg",
    "무당파_약방.jpg": "Wudang_Pharmacy.jpg",
    "무당파_연무장.jpg": "Wudang_TrainingHall.jpg",
    "무당파_자소궁.jpg": "Wudang_PurpleCloudPalace.jpg",
    "무당파_장문인실.jpg": "Wudang_SectLeaderRoom.jpg",
    "무당파_진무전.jpg": "Wudang_TrueMartialHall.jpg",
    "무당파_해검지.jpg": "Wudang_SwordPool.jpg",
    "무림맹_귀빈관.jpg": "Alliance_VIPHall.jpg",
    "무림맹_대의사당.jpg": "Alliance_GreatCouncil.jpg",
    "무림맹_비밀회의실.jpg": "Alliance_SecretMeetingRoom.jpg",
    "무림맹_연무장.jpg": "Alliance_TrainingHall.jpg",
    "무림맹_일반접객실.jpg": "Alliance_ReceptionRoom.jpg",
    "무림맹_정문.jpg": "Alliance_MainGate.jpg",
    "무림맹_지하감옥.jpg": "Alliance_Dungeon.jpg",
    "별채.jpg": "Annex.jpg",
    "북해빙궁_입구.jpg": "IcePalace_Entrance.jpg",
    "빈객실.jpg": "GuestRoom.jpg",
    "사천당가_가주집무실.jpg": "Tang_HeadOffice.jpg",
    "사천당가_당소율방_밤.jpg": "Tang_SoyulRoom_Night.jpg",
    "사천당가_당소율의방.jpg": "Tang_SoyulRoom.jpg",
    "사천당문_만독각.jpg": "Tang_TenThousandPoisonPavilion.jpg",
    "사청당가_대문.jpg": "Tang_MainGate.jpg",
    "소림사_나한당.jpg": "Shaolin_ArhatHall.jpg",
    "소림사_다실.jpg": "Shaolin_TeaRoom.jpg",
    "소림사_대웅전.jpg": "Shaolin_GreatHall.jpg",
    "소림사_면벽동굴.jpg": "Shaolin_WallGazingCave.jpg",
    "소림사_방장실.jpg": "Shaolin_AbbotRoom.jpg",
    "소림사_산문.jpg": "Shaolin_MountainGate.jpg",
    "소림사_손님방.jpg": "Shaolin_GuestRoom.jpg",
    "소림사_승려숙소.jpg": "Shaolin_MonkDorm.jpg",
    "소림사_장경각.jpg": "Shaolin_ScriptureLibrary.jpg",
    "소림사_탑림.jpg": "Shaolin_PagodaForest.jpg",
    "제갈세가_가주집무실.jpg": "Jegal_HeadOffice.jpg",
    "제갈세가_서제.jpg": "Jegal_Study.jpg",
    "제갈세가_손님방.jpg": "Jegal_GuestRoom.jpg",
    "제갈세가_제갈연주의방.jpg": "Jegal_YeonjuRoom.jpg",
    "제갈세가_지략의전당.jpg": "Jegal_StrategyHall.jpg",
    "제갈세가_진법훈련장.jpg": "Jegal_FormationTraining.jpg",
    "제갈세가_천기대.jpg": "Jegal_HeavenlyMachinePlatform.jpg",
    "중원_나루터.jpg": "Jianghu_Ferry.jpg",
    "중원_번화가.jpg": "Jianghu_Downtown.jpg",
    "중원_시장.jpg": "Jianghu_Market.jpg",
    "천마신교_교주집무실.jpg": "Demonic_LeaderOffice.jpg",
    "천마신교_천마궁.jpg": "Demonic_HeavenlyDemonPalace.jpg",
    "천마신교_천예령의방.jpg": "Demonic_YeryeongRoom.jpg",
    "하북팽가_가주집무실.jpg": "Paeng_HeadOffice.jpg",
    "하북팽가_연무장.jpg": "Paeng_TrainingHall.jpg",
    "화산파_매화연무장.jpg": "MtHua_PlumTrainingHall.jpg",
    "화산파_손님방.jpg": "MtHua_GuestRoom.jpg",
    "화산파_입구.jpg": "MtHua_Entrance.jpg",
    "화산파_자하각.jpg": "MtHua_PurpleMistPavilion.jpg",
    "화산파_장문인거처.jpg": "MtHua_LeaderResidence.jpg",
    "화산파_절벽.jpg": "MtHua_Cliff.jpg",
    "화산파_화영의방.jpg": "MtHua_HwayeongRoom.jpg"
}

def rename_files():
    if not os.path.exists(DIR):
        print(f"Directory not found: {DIR}")
        return

    count = 0
    for kor, eng in mapping.items():
        src = os.path.join(DIR, kor)
        dst = os.path.join(DIR, eng)

        if os.path.exists(src):
            try:
                os.rename(src, dst)
                print(f"Renamed: {kor} -> {eng}")
                count += 1
            except Exception as e:
                print(f"Error renaming {kor}: {e}")
        elif os.path.exists(dst):
            print(f"Already Renamed: {kor} (Target exists)")
        else:
            print(f"Source not found: {kor}")

    print(f"Total renamed: {count}")

    # Generate JSON List for Copy-Paste
    # We want Keys (Korean without extension) -> Value (English without extension) for the Map code
    # And Keys (Korean) for the background_list.json
    
    # Generate Map Code
    print("\n\n--- TYPESCRIPT MAP CODE (Copy to background-manager.ts) ---")
    print("const wuxiaBackgroundMap: Record<string, string> = {")
    for kor, eng in mapping.items():
        key = kor.replace(".jpg", "")
        val = eng
        print(f"    '{key}': '{val}',")
    print("};")

    # Generate JSON List
    print("\n\n--- JSON LIST (Copy to background_list.json) ---")
    print("[")
    for kor in mapping.keys():
         key = kor.replace(".jpg", "")
         print(f"    '{key}',")
    print("]")

if __name__ == "__main__":
    rename_files()
