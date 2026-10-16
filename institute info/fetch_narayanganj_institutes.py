import time
import requests
import pandas as pd

# ১. আমাদের মার্জ করা ২১৮টি প্রতিষ্ঠানের মাস্টার ফাইল লোড
input_csv = 'narayanganj_all_institutes_218_master.csv'
print(f"'{input_csv}' ফাইল লোড হচ্ছে...")
master_df = pd.read_csv(input_csv)

total = len(master_df)
print(f"মোট প্রতিষ্ঠান সংগ্রহ করা হবে: {total} টি\n")

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
}

all_records = []

for idx, (_, row_item) in enumerate(master_df.iterrows(), 1):
    eiin = int(row_item['EIIN'])
    inst_name_from_file = row_item['প্রতিষ্ঠানের নাম']
    print(f"[{idx}/{total}] EIIN: {eiin} ({inst_name_from_file[:20]}...) ...", end=" ")
    
    api_url = f"https://apigw.ieims.banbeis.gov.bd/eatl-config-service/api/v1/institute/public/find-by-eiin/{eiin}"
    
    # ডেটা সংরক্ষণের জন্য ডিকশনারি তৈরি
    item = {
        'eiin': str(eiin),
        'ssc_code': str(row_item.get('SSC_CODE', '') if pd.notna(row_item.get('SSC_CODE')) else '').replace('.0', ''),
        'hsc_code': str(row_item.get('HSC_CODE', '') if pd.notna(row_item.get('HSC_CODE')) else '').replace('.0', ''),
        'name_bn': inst_name_from_file,
        'name_en': row_item.get('NAME OF INSTITUTION', ''),
        'category': 'শিক্ষা প্রতিষ্ঠান',
        'type_file': row_item.get('type', ''),              # স্কুল / কলেজ / স্কুল অ্যান্ড কলেজ
        'institute_type': '',                               # ব্যানবেইস টাইপ
        'education_level': '',                              # মাধ্যমিক / উচ্চ মাধ্যমিক / স্নাতকোত্তর
        'management': '',                                   # সরকারি / বেসরকারি
        'for_whom': '',                                     # সহশিক্ষা / বালক / বালিকা
        'english_version': '',                              # হ্যাঁ / না
        'establishment_date': '',                           # প্রতিষ্ঠার তারিখ
        'area_status': '',                                  # সিটি কর্পোরেশন / পৌরসভা
        'constituency': '',                                 # সংসদীয় আসন
        'division': 'ঢাকা',
        'district': 'নারায়ণগঞ্জ',
        'upazila': row_item.get('উপজেলা', ''),
        'thana_banbeis': '',
        'union_ward': '',
        'mouza': '',
        'address': '',
        'post_office': '',
        'post_code': '',
        'mobile': '',
        'mobile_alt': '',
        'telephone': '',
        'email': '',
        'website': '',
        'source_url': f"https://institute-search.ieims.banbeis.gov.bd/details/{eiin}"
    }

    try:
        res = requests.get(api_url, headers=headers, timeout=12)
        if res.status_code == 200:
            res_json = res.json()
            data = res_json.get('data') or {}
            
            if data:
                # মূল নাম (ব্যানবেইসে থাকলে আপডেট হবে)
                item['name_bn'] = data.get('instituteNameBn') or item['name_bn']
                item['name_en'] = data.get('instituteName') or item['name_en']
                
                item['institute_type'] = data.get('instituteTypeNameBn', '')
                item['education_level'] = data.get('educationLevelNameBn', '')
                item['management'] = data.get('managementNameBn', '')
                item['for_whom'] = data.get('instituteForWhomNameBn', '')
                item['english_version'] = 'হ্যাঁ' if data.get('instituteHasEnglishVersion') else 'না'
                item['establishment_date'] = data.get('establishmentDate', '')
                item['area_status'] = data.get('areaStatusNameBn', '')
                item['constituency'] = data.get('constituencyNameBn', '')
                
                # অবস্থান ও ঠিকানা
                item['thana_banbeis'] = data.get('thanaNameBn', '')
                item['union_ward'] = data.get('unionNameBn', '')
                item['mouza'] = data.get('mouzaNameBn', '')
                item['address'] = data.get('address', '')
                item['post_office'] = (data.get('postOfficeNameBn') or '').strip()
                item['post_code'] = str(data.get('postOfficeCode') or '').strip()
                
                # যোগাযোগ তথ্য (সামনের ০ যাতে বজায় থাকে সেজন্য স্ট্রিং রাখা)
                m = str(data.get('mobile') or '').strip()
                m_alt = str(data.get('mobileAlternate') or '').strip()
                tel = str(data.get('telephone') or '').strip()
                
                item['mobile'] = m if m and m != 'None' else ''
                item['mobile_alt'] = m_alt if m_alt and m_alt != 'None' else ''
                item['telephone'] = tel if tel and tel != 'None' else ''
                item['email'] = str(data.get('email') or '').strip()
                item['website'] = str(data.get('webSite') or '').strip()
                
                print("সফল!")
            else:
                print("ডেটা নেই!")
        else:
            print(f"ব্যর্থ (কোড: {res.status_code})")
    except Exception as e:
        print(f"ত্রুটি: {e}")

    all_records.append(item)
    time.sleep(0.3)  # সার্ভারের ওপর চাপ না ফেলে মসৃণভাবে ডেটা নেওয়ার জন্য ছোট বিরতি

# ২. এক্সেল এবং সিএসভি ফাইলে আউটপুট সেভ করা
df_final = pd.DataFrame(all_records)

# ফোন নম্বরের সামনের শূন্য অক্ষত রাখার জন্য CSV এবং Excel উভয়টিতে সেভ
csv_file = 'narayanganj_all_institutes_banbeis_final.csv'
xlsx_file = 'narayanganj_all_institutes_banbeis_final.xlsx'

df_final.to_csv(csv_file, index=False, encoding='utf-8-sig')
df_final.to_excel(xlsx_file, index=False)

print("\n" + "="*50)
print("অভিনন্দন! সফলভাবে সকল তথ্য সংরক্ষিত হয়েছে:")
print(f"১. {csv_file}")
print(f"২. {xlsx_file}")
print("="*50)