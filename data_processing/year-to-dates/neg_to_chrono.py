# This script organizes the data in a chronological order
# using the negative numbers as indicator. 
# 
# As in Fluorish the time of appearence is indicated by a 
# date-formatted column, we need to convert these numbers 
# into fictional dates. 
# 
# However, some years have more than 365 entries because
# more than a photo was made in the same venue. We need
# to collapse entries with same repository and year into
# a single entry and assign them to a single date.

from datetime import date, timedelta
from pprint import pprint

import pandas as pd

# Load the georeferenced dataset
df_raw = pd.read_csv("sansoni_geo.csv")

# Create a new list of rows to store the final results
#df_map = pd.DataFrame(columns=["date","repository", "place", "lat", "lon"])
df_map_rows = []

# Ancillary values to decimate the dataset
current_repo = None
current_city = None
current_year = None
last_date_y = {}

# For troubleshooting in the dataset (see later)
count_no_y = 0
count_no_c = 0
count_no_p = 0
row_y_mis = []

def save_record(source_row, current_date):

    # Check if this approach works (all records / year < 365)
    if current_date == date(current_date.year, 12, 31):
        print("Warning: more than 365 entries for the year " + str(current_year))

    df_map_rows.append({
        "negID": source_row["negativeId"],
        "date": str(current_date),
        "place": source_row["place"],
        "repository": source_row["repository"],
        "lat": str(source_row["lat"]),
        "lon": str(source_row["lon"])
    })
    

for i, row in df_raw.iterrows():

    # Hard-coded escape for records with non-aligned 
    # year and negative numbers
    """
    if 0 < i < len(df_raw):
        if row["year"] != df_raw.loc[i-1, "year"] and row["year"] != df_raw.loc[i+1, "year"]: 
            row_y_mis.append(row["negativeId"])
            continue
    """

    # =================================
    # ==== DATASET TROUBLESHOOTING ==== 
    if pd.isna(row["year"]):
        print("YEAR missing for #" + str(i))
        count_no_y += 1
        continue

    if pd.isna(row["place"]):
        print("CITY missing for #" + str(i))
        count_no_c += 1
        continue

    if pd.isna(row["repository"]):
        print("REPOSITORY missing for #" + str(i))
        count_no_p += 1
        continue
    # =================================

    # 1) Check the year: 
    # If it is not the same of the previous record, store the  
    # value of the year and the repository and initialise the
    # date on Jan. 1st of that year(es 01/01/1925)

    if (current_year == None or current_year != row["year"]) and row["year"] not in last_date_y:

        current_year = int(row["year"])
        current_date = date(current_year, 1, 1)

        last_date_y[current_year] = current_date

        current_city = row["place"]
        current_repo = row["repository"]

        save_record(row, current_date)

    else:
        # 2) Check the place:
        # If the city and the repository does not coincide with the
        # previous one, add one day more and store it to the final 
        # list.

        if current_city == None or current_city != row["place"]:

            current_city = row["place"]
            current_date += timedelta(days=1)
            last_date_y[current_year] = current_date
            save_record(row, current_date)

        else:

            if current_repo == None or current_repo != row["repository"]:
                current_repo = row["repository"]
                current_date += timedelta(days=1)
                last_date_y[current_year] = current_date
                save_record(row, current_date)
        
            # Else skip the record: Sansoni did not move
            else:
                continue
            
        # skip

df_map = pd.DataFrame(df_map_rows, columns=["negID", "date", "repository", "place", "lat", "lon"])

# Save the final dataset
df_map.to_excel("sansoni_final.xlsx", index=False)

print("================================")
print("Done! Final dataset saved as sansoni_final.xlsx")
print(f"Total single records in df: {len(df_map)}")
print("--- Missing values ---")
print(f"Records with missing year: {count_no_y}")
print(f"Records with missing city: {count_no_c}")
print(f"Records with missing repository: {count_no_p}")
print("--- Mismatched values ---")
print(f"Year and negID: {len(row_y_mis)}")
print(pprint(row_y_mis))