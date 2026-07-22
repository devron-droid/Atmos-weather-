# Drop your weather background photos in here

The dashboard looks for files using this exact naming pattern:

    <condition>-day.jpg
    <condition>-night.jpg

Conditions used by the app:

    clear-day.jpg        clear-night.jpg
    cloudy-day.jpg       cloudy-night.jpg
    partly-day.jpg       partly-night.jpg
    rain-day.jpg         rain-night.jpg
    heavy-rain-day.jpg   heavy-rain-night.jpg
    storm-day.jpg        storm-night.jpg
    snow-day.jpg         snow-night.jpg
    fog-day.jpg          fog-night.jpg
    wind-day.jpg         wind-night.jpg

Recommended: 1920x1080 or larger, landscape, JPG, under ~400KB each
(the app will still work with bigger files, they'll just load slower on
mobile). If a file for a condition is missing, Atmos automatically falls
back to your original mountain/meadow photo with an animated gradient
tint for that condition — nothing breaks, the site just looks a little
less specific until you add that image.

Sunrise/sunset get handled automatically: the app blends toward
"-day" or "-night" based on the actual sunrise/sunset time for the
city being viewed, not the device clock.
