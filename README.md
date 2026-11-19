# port-meridian

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kochak05/port-meridian/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kochak05/port-meridian/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Port Meridian is an original top-down 2D open-world crime game: explore a
sun-soaked city on foot and by car, steal cars, outrun the police, and
complete 3 missions (Courier Run, Getaway Car, Harbor Heist) with combat,
traffic, pedestrians, a wanted level, HUD and minimap.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

## Controls

- WASD / arrows — walk or drive
- E — enter / exit a car
- Space / X — shoot
- S / Down while driving — brake
- P — pause, M — mute, Enter — start / restart

## Missions

1. **Courier Run** — pick up a parcel in the north-east, drop it at the
   south-west docks. Pays $350.
2. **Getaway Car** — steal the gold coupe in the north-west and lose the
   cops on the way to the east garage. Pays $500.
3. **Harbor Heist** — clear the warehouse guards, crack the safe, reach the
   rendezvous in the north. Pays $950.

Finish all three and Mara Voss takes $1,800 home. Progress saves to
localStorage between visits.
