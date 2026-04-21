# This script integrates the source dataset: it accesses the
# place names and retrieves their geocoordinates (lat, lon)

import pandas as pd
import requests
import time

# Retrieve geocordinates with Nominatim API (OpenStreetMap)
def geocode_place(place_name):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": place_name,
        "format": "json",
        "limit": 1
    }
    headers = {"User-Agent": "geocoder-script/1.0"}
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        results = response.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:
        print(f"Error per '{place_name}': {e}")
    
    return None, None

# Upload raw dataset
df = pd.read_csv("sansoni_data.csv") 

df["lat"] = None
df["lon"] = None

# Iterate over the dataset
for i, row in df.iterrows():
    place = row["place"]
    lat, lon = geocode_place(place)
    df.at[i, "lat"] = lat
    df.at[i, "lon"] = lon
    print(f"[{i+1}/{len(df)}] {place} → {lat}, {lon}")
    time.sleep(1)  # Nominatim requires max 1 req/sec

# Save the result
df.to_csv("sansoni_geo.csv", index=False)
print("Dataset with geocoordinates saved")