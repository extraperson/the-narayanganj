import time
import requests
import pandas as pd

# ১. স্কুল ও কলেজের ফাইল লোড করে ইউনিক EIIN তালিকা নেওয়া
print("ফাইল লোড হচ্ছে...")
schools = pd.read_csv('narayanganj_schools_1-190_bengali.csv')
colleges = pd.read_csv('narayanganj_colleges_1-55.csv')

# ইউনিক EIIN লিস্ট তৈরি
all_institutes = pd.concat([schools[['EIIN', 'প্রতিষ্ঠানের নাম', 'উপজেলা']], 
                            colleges[['EIIN', 'প্রতিষ্ঠানের নাম', 'উপজেলা']]]).drop_duplicates(subset=['EIIN'])

eiin_list = all_institutes['EIIN'].dropna().astype(int).tolist()
total = len(eiin_list)
print(f"মোট প্রতিষ্ঠান সংগ্রহ করা হবে: {total} টি\n")

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
}

extracted_data = []

for idx, eiin in enumerate(eiin_list, 1):
    api_url = f"https://apigw.ieims.banbeis.gov.bd/eatl-config-service/api/v1/institute/public/find-by-eiin/{eiin}"
    print(f"[{idx}/{total}] তথ্য আসছে EIIN: {eiin} ...", end=" ")
    
    # গুগল শিট ও অ্যাপ ফ্রেন্ডলি ডিফল্ট স্ট্রাকচার
    row = {
        'eiin': eiin,
        'name_en': '',
        'name_bn': '',
        'category': 'শিক্ষা প্রতিষ্ঠান',
        'type': '',               # স্কুল / কলেজ
        'education_level': '',    # মাধ্যমিক / উচ্চ মাধ্যমিক / স্নাতকোত্তর
        'management': '',         # সরকারি / বেসরকারি
        'english_version': '',    # হ্যাঁ / না
        'established_date': '',   # প্রতিষ্ঠার তারিখ
        'area_status': '',        # সিটি কর্পোরেশন / পৌরসভা
        'status': '',             # চলমান
        'division': '',
        'district': '',
        'upazila': '',
        'union_ward': '',
        'mouza': '',
        'post_office': '',
        'address': '',
        'phone': '',              # মোবাইল নম্বর
        'alt_phone': '',          # বিকল্প মোবাইল
        'telephone': '',          # ল্যান্ডলাইন
        'email': '',
        'website': '',
        'source_url': f"https://institute-search.ieims.banbeis.gov.bd/details/{eiin}"
    }
    
    try:
        res = requests.get(api_url, headers=headers, timeout=12)
        if res.status_code == 200:
            json_res = res.json()
            # ব্যানবেইসের API ডেটা সাধারণত payload বা data এর মধ্যে থাকে
            d = json_res.get('payload', json_res.get('data', json_res))
            
            # ডেটা পার্সিং (সাধারণ কি-নেম হ্যান্ডলিং)
            row['name_en'] = d.get('instituteName', d.get('institute_name', d.get('nameEn', '')))
            row['name_bn'] = d.get('instituteNameBn', d.get('institute_name_bn', d.get('nameBn', '')))
            row['type'] = d.get('instituteType', d.get('institute_type', ''))
            row['education_level'] = d.get('educationLevel', d.get('education_level', ''))
            row['management'] = d.get('managementType', d.get('management', ''))
            row['english_version'] = d.get('isEnglishVersion', d.get('english_version', ''))
            row['established_date'] = d.get('establishmentDate', d.get('established_date', ''))
            row['area_status'] = d.get('areaStatus', d.get('area_status', ''))
            row['status'] = d.get('status', '')
            
            # অবস্থান ও ঠিকানা
            row['division'] = d.get('divisionName', d.get('division', 'ঢাকা'))
            row['district'] = d.get('districtName', d.get('district', 'নারায়ণগঞ্জ'))
            row['upazila'] = d.get('upazilaName', d.get('upazila', ''))
            row['union_ward'] = d.get('unionName', d.get('union_ward', ''))
            row['mouza'] = d.get('mouzaName', d.get('mouza', ''))
            row['post_office'] = d.get('postOffice', d.get('post_office', ''))
            row['address'] = d.get('address', d.get('location', ''))
            
            # যোগাযোগ
            row['phone'] = str(d.get('mobile', d.get('mobileNo', ''))).strip()
            row['alt_phone'] = str(d.get('altMobile', d.get('alt_mobile', ''))).strip()
            row['telephone'] = str(d.get('telephone', d.get('phone', ''))).strip()
            row['email'] = d.get('email', '')
            row['website'] = d.get('website', '')
            
            # যদি সরাসরি পুরো অবজেক্ট অন্য কি-তে থাকে
            print("সফল!")
        else:
            print(f"ব্যর্থ (Status {res.status_code})")
    except Exception as e:
        print(f"ত্রুটি: {e}")
        
    extracted_data.append(row)
    time.sleep(0.3)  # সার্ভারে চাপ না দিয়ে স্মুথলি ডেটা নেওয়ার জন্য ছোট বিরতি

# ২. এক্সেল এবং সিএসভি উভয় ফরম্যাটেই সেভ করা
df_result = pd.DataFrame(extracted_data)

# গুগল শিটে যাতে ফোন নম্বরের আগের '০' মুছে না যায় সেজন্য টেক্সট ফরম্যাট রাখা
df_result.to_csv('narayanganj_all_institutes_banbeis.csv', index=False, encoding='utf-8-sig')
df_result.to_excel('narayanganj_all_institutes_banbeis.xlsx', index=False)

print("\nঅভিনন্দন! সফলভাবে সব ডেটা সেভ হয়েছে:")
print("১. narayanganj_all_institutes_banbeis.xlsx")
print("২. narayanganj_all_institutes_banbeis.csv")