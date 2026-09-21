import pandas as pd
import json

df = pd.read_excel("price_book_item.xls")
print("Total rows in price_book_item.xls:", len(df))

price_map = {}
for _, row in df.iterrows():
    item_id = str(row["Item ID"]).strip()
    name = str(row["Item Name"]).strip() if pd.notnull(row["Item Name"]) else ""
    mrp = float(row["Item Price"]) if pd.notnull(row["Item Price"]) else 0.0
    rate = float(row["PriceList Rate"]) if pd.notnull(row["PriceList Rate"]) else None
    discount = float(row["Discount"]) if pd.notnull(row["Discount"]) else None
    
    price_map[item_id] = {
        "id": item_id,
        "name": name,
        "mrp": mrp,
        "dealerRate": rate,
        "discount": discount
    }

print(f"Parsed {len(price_map)} items into price map.")
sample_crystal = price_map.get("3334672000000839771")
print("Crystal 3B in pricebook:", sample_crystal)

sample_kettle = price_map.get("3334672000000194828")
print("Kettle in pricebook:", sample_kettle)

# Save as json for instant high-speed lookup in api / client
with open("src/data/dealer_pricebook.json", "w", encoding="utf-8") as f:
    json.dump(price_map, f, indent=2)

print("Saved src/data/dealer_pricebook.json")
