from supabase import create_client
import pandas as pd
import os

client = create_client(os.environ["SUPBASE_URL"], os.environ["SUPABASE_KEY"])
response = client.table("bronze_geolife_traces").select("*").execute()

