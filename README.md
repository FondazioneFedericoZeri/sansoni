# Mario Sansoni's photographic campaign in Italy

From 1931 to 1951 Mario Sansoni was commissioned a photographic campaign of relevant artworks in Italy for the Frick Collection in New York. This repository hosts an interactive web visualisation of the places he documented over this period.

The folder `data_processing` also hosts additional Python code for data cleaning and augmentation (georeference code).

The interactive application is reusable with other dataset. Besides changing static HTML content, it is necessary to change the source dataset in `web-app/data.csv`, formatted as follows:
- `city`: Name of the city
- `total`: Total amount of photographs
- `year`: Year when the city was visited
- `lat`: Latitude of the city
- `lng`: Longitude of the city