/* fittings.js — PipeSpec fittings & flange module
   Lifted from Pipeline motor/Pipeline_Calculator_EN13480_Fixed.html
   Functions: FL_DATA (ln 2447), FL_DIMS (ln 2550), FL_THREAD (ln 2552),
   interpFlange (ln 2458), calcBend (ln 2477), calcReducer (ln 2501),
   calcTee (ln 2525), calcFlange (ln 2554),
   fl_pc_synced / fl_T_synced / flOnManual / flSyncReset / flSyncFromSection2 (ln 2847),
   _batchCalcOneFlange (ln 2903), _batchBuildFlangeCard (ln 2936)
*/

// ── EN 1092-1 ANNEX G DATA ────────────────────────────────────────────────────
const FL_DATA = {
  '3E0_s50': { name: 'P235GH / P265GH (3E0, wall ≤ 50mm)', temps: [20,100,150,200,250,300,350,400,450], pn: {
    6:   [6.0,5.5,5.2,5.0,4.5,4.1,3.8,3.5,1.9],
    10:  [10.0,9.2,8.8,8.3,7.6,6.9,6.4,5.9,3.2],
    16:  [16.0,14.8,14.0,13.3,12.1,11.0,10.2,9.5,5.2],
    25:  [25.0,23.2,22.0,20.8,19.0,17.2,16.0,14.8,8.2],
    40:  [40.0,37.1,35.2,33.3,30.4,27.6,25.7,23.8,13.1],
    63:  [63.0,58.5,55.5,52.5,48.0,43.5,40.5,37.5,20.7],
    100: [100.0,92.8,88.0,83.3,76.1,69.0,64.2,59.5,32.8],
    160: [160.0,148.5,140.9,133.3,121.9,110.4,102.8,95.2,52.5],
    250: [250.0,232.1,220.2,208.3,190.4,172.6,160.7,148.8,82.1] }},
  '3E0_s150': { name: 'P235GH / P265GH (3E0, 50 < wall ≤ 150mm)', temps: [20,100,150,200,250,300,350,400,450], pn: {
    6:   [6.0,5.1,5.0,4.7,4.2,3.9,3.6,3.4,1.9],
    10:  [10.0,8.5,8.3,7.7,7.0,6.4,6.0,5.7,3.2],
    16:  [16.0,13.7,13.3,12.4,11.3,10.2,9.6,9.1,5.2],
    25:  [25.0,21.4,20.8,19.4,17.7,16.0,15.1,14.2,8.2],
    40:  [40.0,34.2,33.3,31.0,28.3,25.7,24.1,22.8,13.1],
    63:  [63.0,54.0,52.5,48.9,44.7,40.5,38.1,36.0,20.7],
    100: [100.0,85.7,83.3,77.6,70.9,64.2,60.4,57.1,32.8],
    160: [160.0,137.1,133.3,124.1,113.5,102.8,96.7,91.4,52.5],
    250: [250.0,214.2,208.3,194.0,177.3,160.7,151.1,142.8,82.1] }},
  '14E0': { name: '1.4401 / AISI 316 (14E0)', temps: [20,100,150,200,250,300,350,400,450,500,550], pn: {
    6:   [6.0,6.0,5.4,5.0,4.7,4.4,4.2,4.1,4.0,3.9,3.8],
    10:  [10.0,10.0,9.0,8.4,7.9,7.4,7.1,6.8,6.7,6.5,6.4],
    16:  [16.0,16.0,14.5,13.4,12.7,11.8,11.4,10.9,10.7,10.4,10.3],
    25:  [25.0,25.0,22.7,21.0,19.8,18.5,17.8,17.1,16.8,16.3,16.0],
    40:  [40.0,40.0,36.3,33.7,31.8,29.7,28.5,27.4,26.9,26.0,25.7],
    63:  [63.0,63.0,57.3,53.1,50.1,46.8,45.0,43.2,42.4,41.1,40.5],
    100: [100.0,100.0,90.9,84.2,79.5,74.2,71.4,68.5,67.3,65.2,64.3],
    160: [160.0,160.0,145.5,134.8,127.2,118.8,114.2,109.7,107.8,104.3,103.0],
    250: [250.0,250.0,227.3,210.7,198.8,185.7,178.5,171.4,168.4,163.0,160.9] }},
  '13E0': { name: '1.4404 / AISI 316L (13E0)', temps: [20,50,100,150,200,250,300,350,400,450,500], pn: {
    6:   [6.0,5.8,5.4,5.1,4.7,4.4,4.1,3.9,3.8,3.7,3.6],
    10:  [10.0,9.4,8.6,7.9,7.4,6.9,6.6,6.4,6.2,6.0,null],
    16:  [16.0,15.1,13.7,12.7,11.9,11.0,10.5,10.2,10.0,9.7,null],
    25:  [25.0,23.6,21.5,19.8,18.6,17.2,16.5,16.0,15.6,15.2,null],
    40:  [40.0,37.9,34.4,31.8,29.9,27.6,26.4,25.7,25.0,24.3,null],
    63:  [63.0,59.7,54.3,50.1,47.1,43.5,41.7,40.5,39.4,38.4,null],
    100: [100.0,94.7,86.1,79.5,74.7,69.0,66.1,64.2,62.6,60.9,null],
    160: [160.0,151.6,137.9,127.2,119.6,110.4,105.9,102.8,100.1,97.5,null],
    250: [250.0,236.9,215.4,198.8,186.9,172.6,165.4,160.7,156.5,152.3,null] }},
  '11E0': { name: '1.4301 / AISI 304 (11E0)', temps: [20,50,100,150,200,250,300,350,400,450,500,550], pn: {
    6:   [6.0,5.7,5.4,4.9,4.5,4.1,3.8,3.7,3.6,3.5,null,null],
    10:  [10.0,9.5,9.0,8.2,7.5,6.9,6.4,6.1,5.9,5.8,null,null],
    16:  [16.0,15.2,14.4,13.1,12.0,11.0,10.3,9.8,9.5,9.3,null,null],
    25:  [25.0,23.8,22.7,20.4,18.6,17.2,16.0,15.3,14.8,14.5,14.2,null],
    40:  [40.0,38.0,36.3,32.7,29.9,27.6,25.7,24.5,23.8,23.3,22.8,null],
    63:  [63.0,59.9,57.3,51.6,47.1,43.5,40.5,38.7,37.5,36.7,36.0,null],
    100: [100.0,95.0,90.9,81.9,74.7,69.0,64.2,61.4,59.5,58.3,57.1,null],
    160: [160.0,152.0,145.5,131.0,119.6,110.4,102.8,98.2,95.2,93.3,91.4,null],
    250: [250.0,237.5,227.3,204.7,186.9,172.6,160.7,153.5,148.8,145.8,142.8,null] }},
  '15E0': { name: '1.4571 / AISI 316Ti (15E0)', temps: [20,50,100,150,200,250,300,350,400,450,500,550], pn: {
    6:   [6.0,6.0,6.0,5.9,5.6,5.3,5.0,4.8,4.7,4.6,4.5,4.5],
    10:  [10.0,10.0,10.0,9.8,9.3,8.8,8.3,8.0,7.8,7.7,7.5,7.5],
    16:  [16.0,16.0,16.0,15.7,14.9,14.1,13.3,12.8,12.5,12.2,12.0,12.0],
    25:  [25.0,25.0,25.0,24.5,23.3,22.1,20.8,20.1,19.5,19.1,18.8,18.6],
    40:  [40.0,40.0,40.0,39.2,37.3,35.4,33.3,32.1,31.2,30.6,30.0,29.9],
    63:  [63.0,63.0,63.0,61.8,58.8,55.8,52.5,50.7,49.2,48.3,47.4,47.1],
    100: [100.0,100.0,98.0,93.3,88.5,83.3,80.4,78.0,76.6,75.2,74.7,null],
    160: [160.0,160.0,156.9,149.3,141.7,133.3,128.7,124.9,122.6,120.3,119.6,null],
    250: [250.0,250.0,245.2,233.3,221.4,208.3,201.1,195.2,191.6,188.0,186.9,null] }},
  // EN 1092-1:2018 Annex G Table G.14 — 10E0: 1.4306 / AISI 304L
  '10E0': { name: '1.4306 / AISI 304L (10E0)', temps: [20,50,100,150,200,250,300,350,400,450,500], pn: {
    6:   [6.0,5.6,5.3,4.9,4.5,4.1,3.8,3.7,3.6,3.5,null],
    10:  [10.0,9.3,8.8,8.1,7.5,6.9,6.4,6.1,5.9,5.8,null],
    16:  [16.0,14.8,14.0,12.9,11.9,10.9,10.2,9.8,9.5,9.3,null],
    25:  [25.0,23.2,21.9,20.2,18.6,17.1,15.9,15.3,14.8,14.5,14.2],
    40:  [40.0,37.1,35.0,32.3,29.8,27.3,25.5,24.4,23.7,23.2,22.8],
    63:  [63.0,58.5,55.2,51.0,47.1,43.2,40.3,38.6,37.5,36.6,36.0],
    100: [100.0,92.8,87.6,80.9,74.7,68.5,63.9,61.4,59.5,58.2,57.1],
    160: [160.0,148.5,140.2,129.5,119.5,109.7,102.3,98.3,95.3,93.2,91.4],
    250: [250.0,232.1,218.9,202.3,186.7,171.4,159.8,153.6,149.0,145.6,142.8] }},
  // EN 1092-1:2018 Annex G Table G.26 — 16E0: 1.4462 / Duplex 2205
  '16E0': { name: '1.4462 / Duplex 2205 (16E0)', temps: [20,50,100,150,200,250,300], pn: {
    6:   [6.0,6.0,6.0,6.0,5.8,5.6,5.3],
    10:  [10.0,10.0,10.0,10.0,9.6,9.4,8.8],
    16:  [16.0,16.0,16.0,16.0,15.4,15.0,14.1],
    25:  [25.0,25.0,25.0,25.0,24.0,23.5,22.0],
    40:  [40.0,40.0,40.0,40.0,38.5,37.5,35.3],
    63:  [63.0,63.0,63.0,63.0,60.7,59.1,55.7],
    100: [100.0,100.0,100.0,100.0,96.3,93.9,88.3],
    160: [160.0,160.0,160.0,160.0,154.1,150.2,141.3],
    250: [250.0,250.0,250.0,250.0,240.8,234.7,220.8] }},
  '12E0_541': { name: '1.4541 / AISI 321 (12E0)', temps: [20,50,100,150,200,250,300,350,400,450,500,550], pn: {
    6:   [6.0,6.0,5.6,5.6,5.3,5.0,4.8,4.6,4.5,4.3,4.2,null],
    10:  [10.0,9.9,9.3,8.9,8.4,8.0,7.5,7.3,7.1,6.9,null,null],
    16:  [16.0,15.8,14.9,14.1,13.4,12.7,11.9,11.5,11.2,10.9,null,null],
    25:  [25.0,24.7,23.3,22.1,21.0,19.8,18.8,18.1,17.7,17.3,null,null],
    40:  [40.0,39.6,37.3,35.4,33.7,31.8,30.6,29.7,29.0,28.3,null,null],
    63:  [63.0,62.4,58.8,55.8,53.1,50.1,48.3,46.8,45.7,44.7,null,null],
    100: [100.0,99.0,93.3,88.5,84.2,79.5,76.6,74.2,72.6,70.9,null,null],
    160: [160.0,158.4,149.3,141.7,134.8,127.2,122.6,118.8,116.1,113.5,null,null],
    250: [250.0,247.6,233.3,221.4,210.7,198.8,191.6,185.7,181.5,177.3,null,null] }},
};

// ── FLANGE DIMENSIONS ─────────────────────────────────────────────────────────
const FL_DIMS = {
  6:  { 10:{D:75,K:50,L:11,n:4,bolt:'M10',C:12,H:28,N1:26,A:17.2}, 15:{D:80,K:55,L:11,n:4,bolt:'M10',C:12,H:30,N1:30,A:21.3}, 20:{D:90,K:65,L:11,n:4,bolt:'M10',C:14,H:32,N1:38,A:26.9}, 25:{D:100,K:75,L:11,n:4,bolt:'M10',C:14,H:35,N1:42,A:33.7}, 32:{D:120,K:90,L:14,n:4,bolt:'M12',C:14,H:35,N1:55,A:42.4}, 40:{D:130,K:100,L:14,n:4,bolt:'M12',C:14,H:38,N1:62,A:48.3}, 50:{D:140,K:110,L:14,n:4,bolt:'M12',C:14,H:38,N1:74,A:60.3}, 65:{D:160,K:130,L:14,n:4,bolt:'M12',C:14,H:38,N1:88,A:76.1}, 80:{D:190,K:150,L:18,n:4,bolt:'M16',C:16,H:42,N1:102,A:88.9}, 100:{D:210,K:170,L:18,n:4,bolt:'M16',C:16,H:45,N1:130,A:114.3}, 125:{D:240,K:200,L:18,n:8,bolt:'M16',C:18,H:48,N1:155,A:139.7}, 150:{D:265,K:225,L:18,n:8,bolt:'M16',C:18,H:48,N1:184,A:168.3}, 200:{D:320,K:280,L:18,n:8,bolt:'M16',C:20,H:55,N1:236,A:219.1}, 250:{D:375,K:335,L:18,n:12,bolt:'M16',C:22,H:60,N1:290,A:273.0}, 300:{D:440,K:395,L:22,n:12,bolt:'M20',C:22,H:62,N1:342,A:323.9} },
  16: { 10:{D:90,K:60,L:14,n:4,bolt:'M12',C:16,H:35,N1:28,A:17.2}, 15:{D:95,K:65,L:14,n:4,bolt:'M12',C:16,H:38,N1:32,A:21.3}, 20:{D:105,K:75,L:14,n:4,bolt:'M12',C:18,H:40,N1:40,A:26.9}, 25:{D:115,K:85,L:14,n:4,bolt:'M12',C:18,H:40,N1:46,A:33.7}, 32:{D:140,K:100,L:18,n:4,bolt:'M16',C:18,H:42,N1:56,A:42.4}, 40:{D:150,K:110,L:18,n:4,bolt:'M16',C:18,H:45,N1:64,A:48.3}, 50:{D:165,K:125,L:18,n:4,bolt:'M16',C:18,H:45,N1:74,A:60.3}, 65:{D:185,K:145,L:18,n:8,bolt:'M16',C:18,H:45,N1:92,A:76.1}, 80:{D:200,K:160,L:18,n:8,bolt:'M16',C:20,H:50,N1:105,A:88.9}, 100:{D:220,K:180,L:18,n:8,bolt:'M16',C:20,H:55,N1:134,A:114.3}, 125:{D:250,K:210,L:18,n:8,bolt:'M16',C:22,H:60,N1:160,A:139.7}, 150:{D:285,K:240,L:22,n:8,bolt:'M20',C:22,H:65,N1:192,A:168.3}, 200:{D:340,K:295,L:22,n:8,bolt:'M20',C:24,H:75,N1:252,A:219.1}, 250:{D:405,K:355,L:26,n:12,bolt:'M24',C:26,H:85,N1:312,A:273.0}, 300:{D:460,K:410,L:26,n:12,bolt:'M24',C:28,H:95,N1:368,A:323.9} },
  40: { 10:{D:90,K:60,L:14,n:4,bolt:'M12',C:16,H:35,N1:28,A:17.2}, 15:{D:95,K:65,L:14,n:4,bolt:'M12',C:16,H:38,N1:32,A:21.3}, 20:{D:105,K:75,L:14,n:4,bolt:'M12',C:18,H:40,N1:40,A:26.9}, 25:{D:115,K:85,L:14,n:4,bolt:'M12',C:18,H:40,N1:46,A:33.7}, 32:{D:140,K:100,L:18,n:4,bolt:'M16',C:18,H:42,N1:56,A:42.4}, 40:{D:150,K:110,L:18,n:4,bolt:'M16',C:18,H:45,N1:64,A:48.3}, 50:{D:165,K:125,L:18,n:4,bolt:'M16',C:20,H:48,N1:75,A:60.3}, 65:{D:185,K:145,L:18,n:8,bolt:'M16',C:22,H:52,N1:90,A:76.1}, 80:{D:200,K:160,L:18,n:8,bolt:'M16',C:24,H:58,N1:105,A:88.9}, 100:{D:235,K:190,L:22,n:8,bolt:'M20',C:24,H:65,N1:134,A:114.3}, 125:{D:270,K:220,L:26,n:8,bolt:'M24',C:26,H:68,N1:162,A:139.7}, 150:{D:300,K:250,L:26,n:8,bolt:'M24',C:28,H:75,N1:192,A:168.3}, 200:{D:375,K:320,L:30,n:12,bolt:'M27',C:34,H:88,N1:244,A:219.1}, 250:{D:450,K:385,L:33,n:12,bolt:'M30',C:38,H:105,N1:306,A:273.0}, 300:{D:515,K:450,L:33,n:16,bolt:'M30',C:42,H:115,N1:362,A:323.9} },
  // EN 1092-1:2018 Table 4 — PN25 (same as PN16 for most DNs up to DN150, heavier above)
  25: { 10:{D:90,K:60,L:14,n:4,bolt:'M12',C:16,H:35,N1:28,A:17.2}, 15:{D:95,K:65,L:14,n:4,bolt:'M12',C:16,H:38,N1:32,A:21.3}, 20:{D:105,K:75,L:14,n:4,bolt:'M12',C:18,H:40,N1:40,A:26.9}, 25:{D:115,K:85,L:14,n:4,bolt:'M12',C:18,H:40,N1:46,A:33.7}, 32:{D:140,K:100,L:18,n:4,bolt:'M16',C:18,H:42,N1:56,A:42.4}, 40:{D:150,K:110,L:18,n:4,bolt:'M16',C:18,H:45,N1:64,A:48.3}, 50:{D:165,K:125,L:18,n:4,bolt:'M16',C:20,H:48,N1:75,A:60.3}, 65:{D:185,K:145,L:18,n:8,bolt:'M16',C:22,H:52,N1:90,A:76.1}, 80:{D:200,K:160,L:18,n:8,bolt:'M16',C:24,H:58,N1:105,A:88.9}, 100:{D:235,K:190,L:22,n:8,bolt:'M20',C:24,H:65,N1:134,A:114.3}, 125:{D:270,K:220,L:26,n:8,bolt:'M24',C:26,H:68,N1:162,A:139.7}, 150:{D:300,K:250,L:26,n:8,bolt:'M24',C:28,H:75,N1:192,A:168.3}, 200:{D:375,K:320,L:30,n:12,bolt:'M27',C:34,H:88,N1:244,A:219.1}, 250:{D:450,K:385,L:33,n:12,bolt:'M30',C:38,H:105,N1:306,A:273.0}, 300:{D:515,K:450,L:33,n:16,bolt:'M30',C:42,H:115,N1:362,A:323.9} },
  // EN 1092-1:2018 Table 5 — PN63
  63: { 10:{D:100,K:70,L:14,n:4,bolt:'M12',C:18,H:38,N1:30,A:17.2}, 15:{D:105,K:75,L:14,n:4,bolt:'M12',C:18,H:40,N1:34,A:21.3}, 20:{D:115,K:85,L:14,n:4,bolt:'M12',C:20,H:44,N1:42,A:26.9}, 25:{D:125,K:90,L:14,n:4,bolt:'M12',C:20,H:46,N1:50,A:33.7}, 32:{D:145,K:105,L:18,n:4,bolt:'M16',C:22,H:50,N1:60,A:42.4}, 40:{D:160,K:115,L:22,n:4,bolt:'M20',C:22,H:52,N1:68,A:48.3}, 50:{D:180,K:135,L:22,n:8,bolt:'M20',C:24,H:58,N1:80,A:60.3}, 65:{D:205,K:160,L:22,n:8,bolt:'M20',C:26,H:64,N1:98,A:76.1}, 80:{D:215,K:170,L:22,n:8,bolt:'M20',C:28,H:70,N1:112,A:88.9}, 100:{D:250,K:200,L:26,n:8,bolt:'M24',C:30,H:78,N1:142,A:114.3}, 125:{D:295,K:240,L:30,n:8,bolt:'M27',C:34,H:86,N1:172,A:139.7}, 150:{D:325,K:265,L:30,n:8,bolt:'M27',C:36,H:92,N1:202,A:168.3}, 200:{D:400,K:340,L:33,n:12,bolt:'M30',C:44,H:108,N1:256,A:219.1}, 250:{D:470,K:400,L:36,n:12,bolt:'M33',C:50,H:122,N1:316,A:273.0}, 300:{D:530,K:460,L:36,n:16,bolt:'M33',C:56,H:135,N1:372,A:323.9} },
  // EN 1092-1:2018 Table 6 — PN100
  100: { 10:{D:100,K:70,L:14,n:4,bolt:'M12',C:20,H:40,N1:30,A:17.2}, 15:{D:105,K:75,L:14,n:4,bolt:'M12',C:20,H:44,N1:34,A:21.3}, 20:{D:120,K:85,L:18,n:4,bolt:'M16',C:22,H:48,N1:42,A:26.9}, 25:{D:130,K:95,L:18,n:4,bolt:'M16',C:24,H:52,N1:50,A:33.7}, 32:{D:155,K:110,L:22,n:4,bolt:'M20',C:26,H:56,N1:64,A:42.4}, 40:{D:165,K:120,L:22,n:4,bolt:'M20',C:28,H:60,N1:72,A:48.3}, 50:{D:195,K:145,L:26,n:4,bolt:'M24',C:30,H:66,N1:84,A:60.3}, 65:{D:220,K:170,L:26,n:8,bolt:'M24',C:34,H:76,N1:104,A:76.1}, 80:{D:230,K:180,L:26,n:8,bolt:'M24',C:36,H:82,N1:118,A:88.9}, 100:{D:265,K:210,L:30,n:8,bolt:'M27',C:40,H:92,N1:148,A:114.3}, 125:{D:315,K:250,L:33,n:8,bolt:'M30',C:46,H:104,N1:178,A:139.7}, 150:{D:355,K:280,L:36,n:8,bolt:'M33',C:52,H:118,N1:210,A:168.3}, 200:{D:430,K:360,L:39,n:12,bolt:'M36',C:62,H:140,N1:268,A:219.1}, 250:{D:500,K:425,L:39,n:12,bolt:'M36',C:72,H:158,N1:328,A:273.0}, 300:{D:585,K:490,L:42,n:16,bolt:'M39',C:82,H:175,N1:388,A:323.9} },
  // EN 1092-1:2018 Table 7 — PN160
  160: { 10:{D:105,K:70,L:18,n:4,bolt:'M16',C:24,H:48,N1:32,A:17.2}, 15:{D:115,K:80,L:18,n:4,bolt:'M16',C:26,H:52,N1:36,A:21.3}, 20:{D:130,K:90,L:22,n:4,bolt:'M20',C:28,H:58,N1:44,A:26.9}, 25:{D:140,K:100,L:22,n:4,bolt:'M20',C:30,H:62,N1:52,A:33.7}, 32:{D:165,K:115,L:26,n:4,bolt:'M24',C:32,H:68,N1:66,A:42.4}, 40:{D:175,K:125,L:26,n:4,bolt:'M24',C:34,H:72,N1:74,A:48.3}, 50:{D:210,K:155,L:30,n:4,bolt:'M27',C:38,H:82,N1:88,A:60.3}, 65:{D:235,K:180,L:30,n:8,bolt:'M27',C:42,H:92,N1:108,A:76.1}, 80:{D:250,K:190,L:33,n:8,bolt:'M30',C:46,H:100,N1:124,A:88.9}, 100:{D:295,K:230,L:36,n:8,bolt:'M33',C:52,H:114,N1:156,A:114.3}, 125:{D:345,K:270,L:39,n:8,bolt:'M36',C:60,H:130,N1:188,A:139.7}, 150:{D:385,K:305,L:42,n:8,bolt:'M39',C:68,H:146,N1:218,A:168.3}, 200:{D:470,K:390,L:46,n:12,bolt:'M42',C:82,H:174,N1:280,A:219.1}, 250:{D:555,K:460,L:50,n:12,bolt:'M45',C:96,H:200,N1:342,A:273.0}, 300:{D:640,K:530,L:50,n:16,bolt:'M45',C:110,H:222,N1:402,A:323.9} },
};

const FL_THREAD = {
  6:{thread:'G 1/8"',d1:9.7,tpi:28}, 8:{thread:'G 1/4"',d1:13.2,tpi:19}, 10:{thread:'G 3/8"',d1:16.7,tpi:19},
  15:{thread:'G 1/2"',d1:20.6,tpi:14}, 20:{thread:'G 3/4"',d1:26.4,tpi:14}, 25:{thread:'G 1"',d1:33.2,tpi:11},
  32:{thread:'G 1¼"',d1:41.9,tpi:11}, 40:{thread:'G 1½"',d1:47.8,tpi:11}, 50:{thread:'G 2"',d1:59.6,tpi:11},
  65:{thread:'G 2½"',d1:75.2,tpi:11}, 80:{thread:'G 3"',d1:87.9,tpi:11}, 100:{thread:'G 4"',d1:113.0,tpi:11},
  125:{thread:'G 5"',d1:138.5,tpi:11}, 150:{thread:'G 6"',d1:163.5,tpi:11},
};

// ── FLANGE FIELD SYNC ─────────────────────────────────────────────────────────
let fl_pc_synced = true, fl_T_synced = true;

function flOnManual(field) {
  if (field === 'pc') { fl_pc_synced = false; document.getElementById('fl_pc_sync_btn').style.display = ''; }
  if (field === 'T')  { fl_T_synced  = false; document.getElementById('fl_T_sync_btn').style.display = '';  }
}
function flSyncReset(field) {
  if (field === 'pc') {
    fl_pc_synced = true; document.getElementById('fl_pc_sync_btn').style.display = 'none';
    const v = document.getElementById('pressure').value;
    document.getElementById('fl_pc').value = v ? parseFloat(v).toFixed(2) : '';
    calcFlange();
  }
  if (field === 'T') {
    fl_T_synced = true; document.getElementById('fl_T_sync_btn').style.display = 'none';
    document.getElementById('fl_T').value = document.getElementById('temperature').value || 20;
    calcFlange();
  }
}
function flSyncFromSection2() {
  const pc = document.getElementById('pressure').value;
  const tc = document.getElementById('temperature').value;
  if (fl_pc_synced) document.getElementById('fl_pc').value = pc ? parseFloat(pc).toFixed(2) : '';
  if (fl_T_synced)  document.getElementById('fl_T').value  = tc || 20;
  calcFlange();
}

// ── INTERPOLATE FLANGE RATING ─────────────────────────────────────────────────
function interpFlange(matKey, pnClass, T) {
  const d = FL_DATA[matKey]; if (!d) return null;
  const pRow = d.pn[pnClass]; if (!pRow) return null;
  const temps = d.temps;
  if (T <= temps[0]) return pRow[0];
  if (T > temps[temps.length - 1]) return null;
  for (let i = 0; i < temps.length - 1; i++) {
    if (pRow[i + 1] === null) return null;
    if (T >= temps[i] && T <= temps[i + 1]) {
      const k = (T - temps[i]) / (temps[i + 1] - temps[i]);
      return +(pRow[i] + k * (pRow[i + 1] - pRow[i])).toFixed(2);
    }
  }
  return pRow[pRow.length - 1];
}

// ── BEND CALCULATION — §6.2.3.1 ───────────────────────────────────────────────
function calcBend() {
  if (!LAST) { alert('Run straight pipe first.'); return; }
  const Do  = parseFloat(document.getElementById('bend_od').value) || LAST.Do;
  const R   = parseFloat(document.getElementById('bend_R').value);
  if (!R) { alert('Enter bending radius R.'); return; }
  const e = LAST.e, RDo = R / Do;
  if (RDo <= 0.5) { alert('R/Do must be > 0.5.'); return; }
  const e_int = e * (RDo - 0.25) / (RDo - 0.5);
  const e_ext = e * (RDo + 0.25) / (RDo + 0.5);
  const c0 = LAST.c0 || 0, c2 = LAST.c2 || 0;
  const c1Type = document.getElementById('c1Type').value;
  const c1val  = c1Type === 'percent' ? parseFloat(document.getElementById('c1pct').value) / 100 : parseFloat(document.getElementById('c1fix').value) || 0;
  const eord_int = c1Type === 'percent' ? (e_int + c0 + c2) / (1 - c1val) : e_int + c0 + c1val + c2;
  const lookupPipe = PIPES.find(p => Math.abs(p.od - Do) < 1) || null;
  let schRec = null;
  if (lookupPipe) { const sorted = Object.entries(lookupPipe.sch).sort((a, b) => a[1] - b[1]); schRec = sorted.find(([s, wt]) => wt >= eord_int); }
  document.getElementById('bend_result').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">'
    + kpiBox('R/Do', 'acc', RDo.toFixed(3), '—')
    + kpiBox('e_int (intrados)', 'bad', e_int.toFixed(3), 'mm')
    + kpiBox('e_ext (extrados)', 'ok',  e_ext.toFixed(3), 'mm')
    + kpiBox('eord_int', '', eord_int.toFixed(3), 'mm')
    + (schRec ? kpiBox('Min. schedule', 'ok', schRec[0], 'en=' + schRec[1].toFixed(2) + ' mm') : '')
    + '</div><div class="fbox"><div class="ftit">§6.2.3.1 — Do=' + Do + ' mm, R=' + R + ' mm</div>'
    + 'e_int = ' + e.toFixed(4) + ' × (' + RDo.toFixed(3) + ' − 0.25) / (' + RDo.toFixed(3) + ' − 0.5) = <span class="fr">' + e_int.toFixed(3) + ' mm</span><br>'
    + 'e_ext = ' + e.toFixed(4) + ' × (' + RDo.toFixed(3) + ' + 0.25) / (' + RDo.toFixed(3) + ' + 0.5) = <span class="fr">' + e_ext.toFixed(3) + ' mm</span></div>';
}

// ── REDUCER CALCULATION — §6.4.4 ──────────────────────────────────────────────
function calcReducer() {
  if (!LAST) { alert('Run straight pipe first.'); return; }
  const Dl = parseFloat(document.getElementById('red_dl').value);
  const Ds = parseFloat(document.getElementById('red_ds').value);
  const L  = parseFloat(document.getElementById('red_L').value);
  if (!Dl || !Ds || !L) { alert('Enter D_large, D_small and L.'); return; }
  if (Dl <= Ds) { alert('D_large must be greater than D_small.'); return; }
  const pc = LAST.pc, f = LAST.f, z = LAST.z, c0 = LAST.c0 || 0, c2 = LAST.c2 || 0;
  const c1Type = document.getElementById('c1Type').value;
  const c1val  = c1Type === 'percent' ? parseFloat(document.getElementById('c1pct').value) / 100 : parseFloat(document.getElementById('c1fix').value) || 0;
  const alpha_rad = Math.atan((Dl - Ds) / (2 * L));
  const alpha_deg = alpha_rad * 180 / Math.PI;
  const cosA = Math.cos(alpha_rad);
  if (alpha_deg > 60) { alert('α = ' + alpha_deg.toFixed(1) + '° > 60° — §6.4.1 does not apply.'); return; }
  const e_large  = (pc * Dl) / (2 * f * z + pc) / cosA;
  const e_small  = (pc * Ds) / (2 * f * z + pc) / cosA;
  const eord_large = c1Type === 'percent' ? (e_large + c0 + c2) / (1 - c1val) : e_large + c0 + c1val + c2;
  const eord_small = c1Type === 'percent' ? (e_small + c0 + c2) / (1 - c1val) : e_small + c0 + c1val + c2;
  document.getElementById('reducer_result').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px">'
    + kpiBox('Half-angle α', 'acc', alpha_deg.toFixed(2), '°')
    + kpiBox('e_con large end', 'bad', e_large.toFixed(3), 'mm')
    + kpiBox('eord large', '', eord_large.toFixed(3), 'mm')
    + kpiBox('eord small', '', eord_small.toFixed(3), 'mm')
    + '</div><div class="fbox"><div class="ftit">§6.4.4 — ' + Dl + ' → ' + Ds + ' mm, L=' + L + ' mm</div>'
    + 'α = arctan((' + Dl + ' − ' + Ds + ') / (2×' + L + ')) = <span class="fv">' + alpha_deg.toFixed(3) + '°</span><br>'
    + 'e_con (large) = <span class="fr">' + e_large.toFixed(3) + ' mm</span><br>'
    + (alpha_deg > 30 ? '<span style="color:#f39c12">⚠ α > 30° — junction reinforcement check per §6.4.6 required</span>' : '<span style="color:#27ae60">✓ α ≤ 30° — simple cone/cylinder junction</span>')
    + '</div>';
}

// ── T-PIECE CALCULATION — §8 ──────────────────────────────────────────────────
function calcTee() {
  if (!LAST) { alert('Run straight pipe first.'); return; }
  const type     = document.getElementById('tee_type').value;
  const headerOD = parseFloat(document.getElementById('tee_header_od').value) || LAST.Do;
  const branchOD = parseFloat(document.getElementById('tee_branch_od').value);
  if (!branchOD) { alert('Enter branch OD.'); return; }
  const pc = LAST.pc, f = LAST.f, z = LAST.z, c0 = LAST.c0 || 0, c2 = LAST.c2 || 0;
  const c1Type = document.getElementById('c1Type').value;
  const c1val  = c1Type === 'percent' ? parseFloat(document.getElementById('c1pct').value) / 100 : parseFloat(document.getElementById('c1fix').value) || 0;
  const e_branch   = (pc * branchOD) / (2 * f * z + pc);
  const eord_branch= c1Type === 'percent' ? (e_branch + c0 + c2) / (1 - c1val) : e_branch + c0 + c1val + c2;
  const di_Di = branchOD / headerOD;
  const lookBranch = PIPES.find(p => Math.abs(p.od - branchOD) < 3) || null;
  const schBranch  = lookBranch ? Object.entries(lookBranch.sch).sort((a, b) => a[1] - b[1]).find(([s, wt]) => wt >= eord_branch) : null;
  const reinNote   = di_Di >= 0.8 ? '<span style="color:#e74c3c">⚠ di/Di = ' + di_Di.toFixed(3) + ' ≥ 0.8 — reinforcement per §8.4.4 required</span>'
    : di_Di >= 0.5 ? '<span style="color:#f39c12">⚠ di/Di = ' + di_Di.toFixed(3) + ' — check §8.4.3</span>'
    : '<span style="color:#27ae60">✓ di/Di = ' + di_Di.toFixed(3) + ' < 0.5</span>';
  document.getElementById('tee_result').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px">'
    + kpiBox('di/Di', 'acc', di_Di.toFixed(3), '—')
    + kpiBox('e_branch', 'bad', e_branch.toFixed(3), 'mm')
    + kpiBox('eord_branch', '', eord_branch.toFixed(3), 'mm')
    + (schBranch ? kpiBox('Min. schedule', 'ok', schBranch[0], 'en=' + schBranch[1].toFixed(2) + ' mm') : '')
    + '</div><div class="fbox"><div class="ftit">§8 — header OD=' + headerOD + ' mm, branch OD=' + branchOD + ' mm</div>'
    + (type === 'forged' ? '<span style="color:#2ecc71">✓ Forged tee per EN 10253 — no separate pressure calc required per §6.6.3</span><br><br>' : '<span style="color:#f39c12">Fabricated branch — straight pipe formula applied</span><br><br>')
    + 'e_branch = <span class="fr">' + e_branch.toFixed(3) + ' mm</span> &nbsp;|&nbsp; eord = <span class="fr">' + eord_branch.toFixed(3) + ' mm</span><br>' + reinNote + '</div>';
}

// ── FLANGE CALCULATION — EN 1092-1 Annex F + G ────────────────────────────────
function calcFlange() {
  const matKey    = document.getElementById('fl_mat').value;
  const flangeType= document.getElementById('fl_type')?.value || '11';
  const T         = parseFloat(document.getElementById('fl_T').value) || (LAST ? LAST.tc : 20);
  const pc_bar    = parseFloat(document.getElementById('fl_pc').value) || (LAST ? LAST.pc_bar : 0);
  const DN        = parseInt(document.getElementById('fl_dn').value)   || (LAST ? LAST.DN : 0);
  const manualPN  = document.getElementById('fl_pn_manual').value;
  if (!pc_bar || !DN) { document.getElementById('flange_result').innerHTML = '<div class="sbanner info"><span class="sdot"></span>Angiv designtryk og DN.</div>'; return; }
  const matName = FL_DATA[matKey]?.name || matKey;
  const allPN   = [6,10,16,25,40,63,100,160,250];
  let selectedPN = null, selectedPS = null;
  const pnRatings = [];
  for (const pn of allPN) {
    const ps = interpFlange(matKey, pn, T);
    pnRatings.push({ pn, ps });
    if (ps !== null && ps >= pc_bar && selectedPN === null) { selectedPN = pn; selectedPS = ps; }
  }
  if (manualPN) { selectedPN = parseInt(manualPN); selectedPS = interpFlange(matKey, selectedPN, T); }
  if (!selectedPN) { document.getElementById('flange_result').innerHTML = '<div class="sbanner fail"><span class="sdot"></span>Ingen standard PN kan håndtere pc=' + pc_bar.toFixed(2) + ' bar ved ' + T + '°C for ' + matName + '</div>'; return; }
  const ok = selectedPS >= pc_bar, margin = selectedPS - pc_bar;
  const dimTable = FL_DIMS[selectedPN];
  let dims = null, actualDN = DN;
  if (dimTable) { const dnKeys = Object.keys(dimTable).map(Number).sort((a,b)=>a-b); const match = dnKeys.find(k=>k>=DN); const dimDN = match || dnKeys[dnKeys.length-1]; dims = dimTable[dimDN]; actualDN = DN; }
  const pnTableRows = pnRatings.filter(r=>r.ps!==null).map(r=>{
    const isSel=r.pn===selectedPN, rowOk=r.ps>=pc_bar;
    return '<tr class="'+(isSel?'rec-row':(rowOk?'pass-row':''))+'"><td><strong>'+(isSel?'★ ':'')+'PN '+r.pn+'</strong></td><td>'+r.ps.toFixed(1)+' bar</td><td style="color:'+(rowOk?'var(--ok)':'var(--warn)')+'">'+(rowOk?'✓':'✗')+'</td><td>'+(isSel?'<span style="color:var(--ok);font-weight:bold">← Valgt</span>':'')+'</td></tr>';
  }).join('');
  const dimRows = dims ? [['D (flangeydre)',dims.D+' mm'],['K (boltcirkel)',dims.K+' mm'],['L (bolthulsdiameter)',dims.L+' mm'],['Antal bolte',dims.n+'×'],['Boltstørrelse',dims.bolt],['C₂ (flangetykkelse)',dims.C+' mm'],['H₂ (navlængde)',dims.H+' mm'],['N₁ (navdiameter)',dims.N1+' mm'],['A (halsdiameter ydre)',dims.A+' mm'],['DN (brugt)',actualDN]].map((r,i)=>'<tr'+(i%2?' class="alt"':'')+'><td>'+r[0]+'</td><td><strong>'+r[1]+'</strong></td></tr>').join('') : '';
  const threadData = flangeType==='13' ? (FL_THREAD[actualDN]||null) : null;
  const threadRows = threadData ? [['Gevindtype','BSP per ISO 228-1'],['Gevindbetegnelse',threadData.thread],['Indvendig bore d₁',threadData.d1+' mm'],['Gevindstigning',threadData.tpi+' tpi'],['Max PN for Type 13','PN 100']].map((r,i)=>'<tr'+(i%2?' class="alt"':'')+'><td>'+r[0]+'</td><td><strong>'+r[1]+'</strong></td></tr>').join('') : '';
  const flangeTypeLabel = {'11':'Type 11 — Weld Neck','01':'Type 01 — Plate','13':'Type 13 — Threaded (BSP ISO 228-1)'}[flangeType]||flangeType;
  LAST_FLANGE = { matKey,matName,flangeType,flangeTypeLabel,T,pc_bar,DN,actualDN,selectedPN,selectedPS,margin,ok,dims,pnTableRows,dimRows,threadData,threadRows };
  document.getElementById('flange_result').innerHTML =
    '<div class="sbanner '+(ok?'pass':'fail')+'"><span class="sdot"></span>'+(ok?'✓ FLANGE TILSTRÆKKELIG — '+flangeTypeLabel+' — PN '+selectedPN+' — PS_max = '+selectedPS.toFixed(1)+' bar (margin: +'+margin.toFixed(1)+' bar)':'✗ UTILSTRÆKKELIG')+'</div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><button onclick="addFlangeToReport()" style="background:rgba(39,174,96,.15);border:1px solid rgba(39,174,96,.5);color:var(--ok);font-family:var(--mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:8px 16px;cursor:pointer;border-radius:3px;">+ Tilføj flange til rapport</button><span id="flange-add-confirm" style="font-family:var(--mono);font-size:10px;color:var(--ok);display:none">✓ Tilføjet</span></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">'
    + kpiBox('Flangetype','acc',flangeTypeLabel.split(' — ')[0],'')
    + kpiBox('Anbefalet PN','acc','PN '+selectedPN,'')
    + kpiBox('PS_max ved '+T+'°C','ok',selectedPS.toFixed(1),'bar')
    + kpiBox('Margin','ok',(margin>=0?'+':'')+margin.toFixed(1),'bar')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
    + '<div><div style="background:var(--card-2);border:1px solid var(--hair);border-left:3px solid var(--acc);border-radius:3px;padding:11px 15px;font-family:var(--mono);font-size:12px;color:var(--text-2);margin-bottom:12px;line-height:1.85"><div style="color:var(--acc);font-size:10px;letter-spacing:2px;margin-bottom:5px;text-transform:uppercase">PN-klasseoversigt — '+matName+' ved '+T+'°C</div><table class="stbl"><thead><tr><th>PN</th><th>PS_max</th><th>OK?</th><th></th></tr></thead><tbody>'+pnTableRows+'</tbody></table><div style="font-family:var(--mono);font-size:10px;color:var(--acc);margin-top:10px;padding-top:6px;border-top:1px solid var(--hair)"><strong>PS = PN × f<sub>t</sub> / 140 MPa</strong> &nbsp;&nbsp; (EN 1092-1:2018 Annex F, Formel F.2)</div></div></div>'
    + '<div>'+(dims?'<div class="fbox"><div class="ftit">Flangedimensioner — PN '+selectedPN+' / DN '+actualDN+'</div><table class="stbl"><tbody>'+dimRows+'</tbody></table></div>':'')+(threadData?'<div class="fbox" style="margin-top:8px"><div class="ftit">Gevinddata</div><table class="stbl"><tbody>'+threadRows+'</tbody></table></div>':'')+'</div>'
    + '</div>';
}

// ── BATCH FLANGE (pure computation) ──────────────────────────────────────────
function _batchCalcOneFlange(DN) {
  const matKey    = document.getElementById('fl_mat').value;
  const flangeType= document.getElementById('fl_type')?.value || '11';
  const T         = parseFloat(document.getElementById('fl_T').value) || 20;
  const pc_bar    = parseFloat(document.getElementById('fl_pc').value) || (LAST ? LAST.pc_bar : 0);
  const manualPN  = document.getElementById('fl_pn_manual').value;
  if (!pc_bar || !DN) return null;
  const matName = FL_DATA[matKey]?.name || matKey;
  const allPN   = [6,10,16,25,40,63,100,160,250];
  let selectedPN = null, selectedPS = null;
  const pnRatings = [];
  for (const pn of allPN) {
    const ps = interpFlange(matKey, pn, T);
    pnRatings.push({ pn, ps });
    if (ps !== null && ps >= pc_bar && selectedPN === null) { selectedPN = pn; selectedPS = ps; }
  }
  if (manualPN) { selectedPN = parseInt(manualPN); selectedPS = interpFlange(matKey, selectedPN, T); }
  if (!selectedPN) return { matKey,matName,flangeType,T,pc_bar,DN,actualDN:DN,selectedPN:null,selectedPS:null,margin:null,ok:false,dims:null,pnTableRows:'',dimRows:'',threadData:null,threadRows:'' };
  const ok = selectedPS >= pc_bar, margin = selectedPS - pc_bar;
  const dimTable = FL_DIMS[selectedPN];
  let dims = null, actualDN = DN;
  if (dimTable) { const dnKeys = Object.keys(dimTable).map(Number).sort((a,b)=>a-b); const match = dnKeys.find(k=>k>=DN); dims = dimTable[match||dnKeys[dnKeys.length-1]]; actualDN = DN; }
  const pnTableRows = pnRatings.filter(r=>r.ps!==null).map(r=>{
    const isSel=r.pn===selectedPN,rowOk=r.ps>=pc_bar;
    return '<tr class="'+(isSel?'rec-row':(rowOk?'pass-row':''))+'"><td><strong>'+(isSel?'★ ':'')+'PN '+r.pn+'</strong></td><td>'+r.ps.toFixed(1)+' bar</td><td style="color:'+(rowOk?'var(--ok)':'var(--warn)')+'">'+(rowOk?'✓':'✗')+'</td><td>'+(isSel?'<span style="color:var(--ok);font-weight:bold">← Valgt</span>':'')+'</td></tr>';
  }).join('');
  const flangeTypeLabel = {'11':'Type 11 — Weld Neck','01':'Type 01 — Plate','13':'Type 13 — Threaded (BSP ISO 228-1)'}[flangeType]||flangeType;
  return { matKey,matName,flangeType,flangeTypeLabel,T,pc_bar,DN,actualDN,selectedPN,selectedPS,margin,ok,dims,pnTableRows,type:'flange' };
}

function _batchBuildFlangeCard(f) {
  if (!f) return '';
  const noPN = !f.selectedPN;
  const statusCls = f.ok ? 'pass' : 'fail';
  const statusTxt = noPN
    ? '✗ Ingen standard PN kan håndtere pc=' + f.pc_bar.toFixed(2) + ' bar ved ' + f.T + '°C for ' + f.matName
    : (f.ok ? '✓ FLANGE TILSTRÆKKELIG — ' + f.flangeTypeLabel + ' — PN ' + f.selectedPN + ' — PS_max = ' + f.selectedPS.toFixed(1) + ' bar' : '✗ UTILSTRÆKKELIG');
  const kpis = noPN ? '' : kpiBox('Flangetype','acc',f.flangeTypeLabel.split(' — ')[0],'') + kpiBox('Anbefalet PN','acc','PN '+f.selectedPN,'') + kpiBox('PS_max ved '+f.T+'°C','ok',f.selectedPS.toFixed(1),'bar') + kpiBox('Margin','ok',(f.margin>=0?'+':'')+f.margin.toFixed(1),'bar');
  return '<div class="rcard" style="margin-bottom:12px;border-left:3px solid var(--acc)">'
    + '<div class="rcard-h" style="display:flex;align-items:center;gap:10px;justify-content:space-between">'
    + '<h2 style="font-size:13px;font-weight:700;color:var(--text)">Flange DN'+f.DN+' &nbsp;<span style="font-size:10px;font-weight:400;color:var(--text-2)">('+f.flangeTypeLabel+' / '+f.matName+')</span></h2>'
    + '<span style="font-family:var(--mono);font-size:10px;color:'+(f.ok?'#27ae60':'#e74c3c')+';font-weight:600">'+(f.ok?'PASS':'FAIL')+'</span></div>'
    + '<div class="rcard-b"><div class="sbanner '+statusCls+'" style="margin-bottom:10px"><span class="sdot"></span>'+statusTxt+'</div>'
    + (kpis ? '<div class="kgrid" style="margin-bottom:10px">' + kpis + '</div>' : '')
    + (f.pnTableRows ? '<div style="background:var(--card-2);border:1px solid var(--hair);border-left:3px solid var(--acc);border-radius:3px;padding:10px 14px;font-family:var(--mono);font-size:12px;color:var(--text-2);margin-top:10px;line-height:1.85"><div style="color:var(--acc);font-size:10px;letter-spacing:2px;margin-bottom:5px;text-transform:uppercase">PN-klasseoversigt — '+f.matName+' ved '+f.T+'°C</div><table class="stbl"><thead><tr><th>PN</th><th>PS_max</th><th>OK?</th><th></th></tr></thead><tbody>'+f.pnTableRows+'</tbody></table></div>' : '')
    + '</div></div>';
}

// ── BATCH BEND (pure computation) — §6.2.3.1 ─────────────────────────────────
function _batchCalcOneBend(pipeObj, inp) {
  const Do  = pipeObj.od;
  const dn  = pipeObj.dn;
  // Per-DN table takes priority; fall back to global bend_R field; then 1.5×Do
  const perDnEl  = document.getElementById('batchBendR_' + dn);
  const globalEl = document.getElementById('bend_R');
  const RInput = parseFloat(perDnEl?.value || globalEl?.value || '');
  const R = (RInput && RInput / Do > 0.5) ? RInput : 1.5 * Do;
  const usedDefault = !RInput || RInput / Do <= 0.5;

  const e = inp._e_req || ((inp.pc * Do) / (2 * inp.f * inp.z + inp.pc));
  const RDo  = R / Do;
  const e_int = e * (RDo - 0.25) / (RDo - 0.5);
  const e_ext = e * (RDo + 0.25) / (RDo + 0.5);
  const { c0, c2, c1Type, c1val } = inp;
  const eord_int = c1Type === 'percent' ? (e_int + c0 + c2) / (1 - c1val) : e_int + c0 + c1val + c2;
  const sorted = Object.entries(pipeObj.sch).sort((a, b) => a[1] - b[1]);
  const schRec = sorted.find(([, wt]) => wt >= eord_int) || null;

  // Per-DN angle takes priority; fall back to global bend_angle field
  const perDnAng  = document.getElementById('batchBendAngle_' + dn);
  const globalAng = document.getElementById('bend_angle');
  const angleVal  = perDnAng?.value || globalAng?.value || '90';
  const angle = angleVal + '°';

  return { type: 'bend', DN: dn, Do, R, RDo, e, e_int, e_ext, eord_int, schRec, angle,
    pc_bar: inp.pc_bar, tc: inp.tc, ok: !!schRec, usedDefaultR: usedDefault };
}

function _batchBuildBendCard(b) {
  if (!b) return '';
  const statusCls = b.ok ? 'pass' : 'fail';
  const statusTxt = b.ok
    ? '✓ Min. schedule: ' + b.schRec[0] + ' (en = ' + b.schRec[1].toFixed(2) + ' mm ≥ eord_int = ' + b.eord_int.toFixed(3) + ' mm)'
    : '✗ Ingen standard schedule opfylder intrados-kravet';
  return '<div class="rcard" style="margin-bottom:12px;border-left:3px solid #9b59b6">'
    + '<div class="rcard-h" style="display:flex;align-items:center;gap:10px;justify-content:space-between">'
    + '<h2 style="font-size:13px;font-weight:700;color:var(--text)">Bøjning DN' + b.DN + ' &nbsp;<span style="font-size:10px;font-weight:400;color:var(--text-2)">' + b.angle + ' — R=' + b.R.toFixed(0) + ' mm — R/Do=' + b.RDo.toFixed(2) + (b.usedDefaultR ? ' <span style="color:#f39c12">(standard 1.5×Do)</span>' : '') + '</span></h2>'
    + '<span style="font-family:var(--mono);font-size:10px;color:' + (b.ok ? '#27ae60' : '#e74c3c') + ';font-weight:600">' + (b.ok ? 'PASS' : 'FAIL') + '</span></div>'
    + '<div class="rcard-b"><div class="sbanner ' + statusCls + '" style="margin-bottom:10px"><span class="sdot"></span>' + statusTxt + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">'
    + kpiBox('e_int (intrados)', 'bad', b.e_int.toFixed(3), 'mm')
    + kpiBox('e_ext (extrados)', 'ok',  b.e_ext.toFixed(3), 'mm')
    + kpiBox('eord_int', '', b.eord_int.toFixed(3), 'mm')
    + (b.schRec ? kpiBox('Min. schedule', 'ok', b.schRec[0], 'en=' + b.schRec[1].toFixed(2) + ' mm') : kpiBox('Min. schedule', 'bad', '—', ''))
    + '</div></div></div>';
}

// ── BATCH REDUCER (pure computation) — §6.4.4 ────────────────────────────────
function _batchCalcOneReducer(pipeObj, nextPipeObj, inp) {
  if (!nextPipeObj) return null;
  const Dl = pipeObj.od;
  const Ds = nextPipeObj.od;
  if (Dl <= Ds) return null;
  const L = parseFloat(document.getElementById('red_L').value) || (Dl - Ds) * 3;
  const { pc, f, z, c0, c2, c1Type, c1val } = inp;
  const alpha_rad = Math.atan((Dl - Ds) / (2 * L));
  const alpha_deg = alpha_rad * 180 / Math.PI;
  if (alpha_deg > 60) return null;
  const cosA = Math.cos(alpha_rad);
  const e_large  = (pc * Dl) / (2 * f * z + pc) / cosA;
  const e_small  = (pc * Ds) / (2 * f * z + pc) / cosA;
  const eord_large = c1Type === 'percent' ? (e_large + c0 + c2) / (1 - c1val) : e_large + c0 + c1val + c2;
  const eord_small = c1Type === 'percent' ? (e_small + c0 + c2) / (1 - c1val) : e_small + c0 + c1val + c2;
  const schLarge = Object.entries(pipeObj.sch).sort((a,b)=>a[1]-b[1]).find(([,wt])=>wt>=eord_large) || null;
  const schSmall = Object.entries(nextPipeObj.sch).sort((a,b)=>a[1]-b[1]).find(([,wt])=>wt>=eord_small) || null;
  const needsReinf = alpha_deg > 30;
  return { type: 'reducer', DN_large: pipeObj.dn, DN_small: nextPipeObj.dn, Dl, Ds, L,
    alpha_deg, e_large, e_small, eord_large, eord_small, schLarge, schSmall, needsReinf,
    pc_bar: inp.pc_bar, tc: inp.tc, ok: !!(schLarge && schSmall) };
}

function _batchBuildReducerCard(r) {
  if (!r) return '';
  const statusCls = r.ok ? 'pass' : 'fail';
  const warnTxt = r.needsReinf ? '<span style="color:#f39c12">⚠ α = ' + r.alpha_deg.toFixed(1) + '° > 30° — junction reinforcement per §6.4.6 required</span>' : '<span style="color:#27ae60">✓ α = ' + r.alpha_deg.toFixed(1) + '° ≤ 30°</span>';
  return '<div class="rcard" style="margin-bottom:12px;border-left:3px solid #e67e22">'
    + '<div class="rcard-h" style="display:flex;align-items:center;gap:10px;justify-content:space-between">'
    + '<h2 style="font-size:13px;font-weight:700;color:var(--text)">Reducer DN' + r.DN_large + '→DN' + r.DN_small + ' &nbsp;<span style="font-size:10px;font-weight:400;color:var(--text-2)">α=' + r.alpha_deg.toFixed(1) + '°</span></h2>'
    + '<span style="font-family:var(--mono);font-size:10px;color:' + (r.ok ? '#27ae60' : '#e74c3c') + ';font-weight:600">' + (r.ok ? 'PASS' : 'FAIL') + '</span></div>'
    + '<div class="rcard-b"><div style="margin-bottom:10px">' + warnTxt + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">'
    + kpiBox('eord stor ende', '', r.eord_large.toFixed(3), 'mm')
    + kpiBox('eord lille ende', '', r.eord_small.toFixed(3), 'mm')
    + (r.schLarge ? kpiBox('Sch. stor', 'ok', r.schLarge[0], 'en=' + r.schLarge[1].toFixed(2) + ' mm') : kpiBox('Sch. stor', 'bad', '—', ''))
    + (r.schSmall ? kpiBox('Sch. lille', 'ok', r.schSmall[0], 'en=' + r.schSmall[1].toFixed(2) + ' mm') : kpiBox('Sch. lille', 'bad', '—', ''))
    + '</div></div></div>';
}

// ── BATCH TEE (pure computation) — §8 ────────────────────────────────────────
function _batchCalcOneTee(pipeObj, inp) {
  const Do = pipeObj.od;
  const { pc, f, z, c0, c2, c1Type, c1val } = inp;
  // Default: branch = same DN (equal tee)
  const e_branch    = (pc * Do) / (2 * f * z + pc);
  const eord_branch = c1Type === 'percent' ? (e_branch + c0 + c2) / (1 - c1val) : e_branch + c0 + c1val + c2;
  const di_Di = 1.0; // equal tee
  const schBranch = Object.entries(pipeObj.sch).sort((a,b)=>a[1]-b[1]).find(([,wt])=>wt>=eord_branch) || null;
  const reinNote = di_Di >= 0.8 ? 'high' : di_Di >= 0.5 ? 'medium' : 'ok';
  return { type: 'tee', DN: pipeObj.dn, Do, e_branch, eord_branch, di_Di, schBranch, reinNote,
    pc_bar: inp.pc_bar, tc: inp.tc, ok: !!schBranch };
}

function _batchBuildTeeCard(t) {
  if (!t) return '';
  const statusCls = t.ok ? 'pass' : 'fail';
  const reinTxt = t.reinNote === 'high'
    ? '<span style="color:#e74c3c">⚠ di/Di = ' + t.di_Di.toFixed(2) + ' ≥ 0.8 — forstærkning per §8.4.4 kræves</span>'
    : t.reinNote === 'medium'
    ? '<span style="color:#f39c12">⚠ di/Di = ' + t.di_Di.toFixed(2) + ' ≥ 0.5 — kontroller §8.4.3</span>'
    : '<span style="color:#27ae60">✓ di/Di = ' + t.di_Di.toFixed(2) + ' < 0.5</span>';
  return '<div class="rcard" style="margin-bottom:12px;border-left:3px solid #16a085">'
    + '<div class="rcard-h" style="display:flex;align-items:center;gap:10px;justify-content:space-between">'
    + '<h2 style="font-size:13px;font-weight:700;color:var(--text)">T-styk DN' + t.DN + '×DN' + t.DN + ' &nbsp;<span style="font-size:10px;font-weight:400;color:var(--text-2)">Lige T-styk</span></h2>'
    + '<span style="font-family:var(--mono);font-size:10px;color:' + (t.ok ? '#27ae60' : '#e74c3c') + ';font-weight:600">' + (t.ok ? 'PASS' : 'FAIL') + '</span></div>'
    + '<div class="rcard-b"><div style="margin-bottom:10px">' + reinTxt + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">'
    + kpiBox('e_branch', 'bad', t.e_branch.toFixed(3), 'mm')
    + kpiBox('eord_branch', '', t.eord_branch.toFixed(3), 'mm')
    + (t.schBranch ? kpiBox('Min. schedule', 'ok', t.schBranch[0], 'en=' + t.schBranch[1].toFixed(2) + ' mm') : kpiBox('Min. schedule', 'bad', '—', ''))
    + '</div></div></div>';
}

// ── FITTINGS INIT ─────────────────────────────────────────────────────────────
(function _fittingsInit() {
  function run() {
    // Wire flange field sync
    document.getElementById('pressure')?.addEventListener('input', flSyncFromSection2);
    document.getElementById('temperature')?.addEventListener('input', flSyncFromSection2);

    // Wire fl_pc / fl_T manual input
    document.getElementById('fl_pc')?.addEventListener('input', () => { flOnManual('pc'); calcFlange(); });
    document.getElementById('fl_T')?.addEventListener('input',  () => { flOnManual('T');  calcFlange(); });
    document.getElementById('fl_dn')?.addEventListener('input', calcFlange);
    document.getElementById('fl_mat')?.addEventListener('change', calcFlange);
    document.getElementById('fl_type')?.addEventListener('change', calcFlange);
    document.getElementById('fl_pn_manual')?.addEventListener('change', calcFlange);

    // Wire sync reset buttons
    document.getElementById('fl_pc_sync_btn')?.addEventListener('click', () => flSyncReset('pc'));
    document.getElementById('fl_T_sync_btn')?.addEventListener('click',  () => flSyncReset('T'));

    // Initialise fl_pc / fl_T from current pressure/temp values
    const pEl = document.getElementById('pressure');
    const tEl = document.getElementById('temperature');
    const pcEl = document.getElementById('fl_pc');
    const tFl  = document.getElementById('fl_T');
    if (pEl?.value && pcEl) pcEl.value = parseFloat(pEl.value).toFixed(2);
    if (tEl?.value && tFl)  tFl.value  = tEl.value;
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
})();
