// 第三季的圖片清單。atlas：俯視圖的圖集，每張小圖的位置（x, y, w, h）、旋轉中心（ax, ay）和身體半徑（r），單位是像素。
// pictures：插圖（首領、事件、標題）的路徑。
// 由 tools/art-slice.py 產生，不要手改；圖是請圖像模型畫的原創素材，沒有用到任何遊戲的圖。
(function (E) {
  const S3 = (E.s3 = E.s3 || {});
  S3.atlas = {
    "actors": {
      "src": "assets/s3/actors.png",
      "items": {
        "hacker": {
          "x": 1,
          "y": 1,
          "w": 120,
          "h": 82,
          "ax": 43.6,
          "ay": 41.0,
          "r": 39.0
        },
        "physical": {
          "x": 162,
          "y": 1,
          "w": 129,
          "h": 82,
          "ax": 45.8,
          "ay": 40.5,
          "r": 39.0
        },
        "social": {
          "x": 323,
          "y": 1,
          "w": 142,
          "h": 96,
          "ax": 41.0,
          "ay": 48.0,
          "r": 46.0
        },
        "specialist": {
          "x": 484,
          "y": 1,
          "w": 122,
          "h": 83,
          "ax": 42.3,
          "ay": 41.0,
          "r": 40.0
        },
        "guard": {
          "x": 1,
          "y": 141,
          "w": 128,
          "h": 88,
          "ax": 39.3,
          "ay": 44.5,
          "r": 42.5
        },
        "rusher": {
          "x": 162,
          "y": 141,
          "w": 125,
          "h": 96,
          "ax": 43.4,
          "ay": 48.0,
          "r": 46.0
        },
        "shield": {
          "x": 323,
          "y": 141,
          "w": 97,
          "h": 107,
          "ax": 53.8,
          "ay": 53.5,
          "r": 51.5
        },
        "sniper": {
          "x": 484,
          "y": 141,
          "w": 159,
          "h": 86,
          "ax": 42.1,
          "ay": 43.0,
          "r": 41.0
        },
        "bomber": {
          "x": 1,
          "y": 281,
          "w": 122,
          "h": 96,
          "ax": 37.9,
          "ay": 48.5,
          "r": 46.5
        },
        "jammer": {
          "x": 162,
          "y": 281,
          "w": 129,
          "h": 99,
          "ax": 38.9,
          "ay": 49.5,
          "r": 43.5
        },
        "heavy": {
          "x": 323,
          "y": 281,
          "w": 148,
          "h": 102,
          "ax": 52.0,
          "ay": 50.5,
          "r": 49.0
        },
        "drone": {
          "x": 484,
          "y": 281,
          "w": 106,
          "h": 102,
          "ax": 52.5,
          "ay": 51.0,
          "r": 47.5
        },
        "hound": {
          "x": 1,
          "y": 421,
          "w": 118,
          "h": 82,
          "ax": 46.1,
          "ay": 41.0,
          "r": 33.5
        },
        "turret": {
          "x": 162,
          "y": 421,
          "w": 116,
          "h": 88,
          "ax": 38.9,
          "ay": 44.5,
          "r": 42.5
        },
        "bulldog": {
          "x": 323,
          "y": 421,
          "w": 132,
          "h": 138,
          "ax": 73.8,
          "ay": 68.5,
          "r": 66.5
        },
        "carrier": {
          "x": 484,
          "y": 421,
          "w": 127,
          "h": 129,
          "ax": 62.8,
          "ay": 64.5,
          "r": 62.5
        }
      }
    },
    "props": {
      "src": "assets/s3/props.png",
      "items": {
        "car": {
          "x": 1,
          "y": 1,
          "w": 122,
          "h": 86,
          "ax": 61.0,
          "ay": 43.0,
          "r": 43.0
        },
        "forklift": {
          "x": 145,
          "y": 1,
          "w": 138,
          "h": 82,
          "ax": 69.0,
          "ay": 41.0,
          "r": 41.0
        },
        "crate": {
          "x": 289,
          "y": 1,
          "w": 96,
          "h": 96,
          "ax": 48.0,
          "ay": 48.0,
          "r": 48.0
        },
        "barrel": {
          "x": 433,
          "y": 1,
          "w": 96,
          "h": 110,
          "ax": 48.0,
          "ay": 55.0,
          "r": 48.0
        },
        "junction": {
          "x": 1,
          "y": 131,
          "w": 106,
          "h": 128,
          "ax": 53.0,
          "ay": 64.0,
          "r": 53.0
        },
        "vent": {
          "x": 145,
          "y": 131,
          "w": 108,
          "h": 108,
          "ax": 54.0,
          "ay": 54.0,
          "r": 54.0
        },
        "bollard": {
          "x": 289,
          "y": 131,
          "w": 94,
          "h": 90,
          "ax": 47.0,
          "ay": 45.0,
          "r": 45.0
        },
        "pylon": {
          "x": 433,
          "y": 131,
          "w": 107,
          "h": 121,
          "ax": 53.5,
          "ay": 60.5,
          "r": 53.5
        },
        "camera": {
          "x": 1,
          "y": 261,
          "w": 122,
          "h": 72,
          "ax": 61.0,
          "ay": 36.0,
          "r": 36.0
        },
        "speaker": {
          "x": 145,
          "y": 261,
          "w": 120,
          "h": 93,
          "ax": 60.0,
          "ay": 46.5,
          "r": 46.5
        },
        "spider": {
          "x": 289,
          "y": 261,
          "w": 132,
          "h": 106,
          "ax": 66.0,
          "ay": 53.0,
          "r": 53.0
        },
        "mine": {
          "x": 433,
          "y": 261,
          "w": 96,
          "h": 92,
          "ax": 48.0,
          "ay": 46.0,
          "r": 46.0
        },
        "med": {
          "x": 1,
          "y": 391,
          "w": 112,
          "h": 104,
          "ax": 56.0,
          "ay": 52.0,
          "r": 52.0
        },
        "data": {
          "x": 145,
          "y": 391,
          "w": 108,
          "h": 106,
          "ax": 54.0,
          "ay": 53.0,
          "r": 53.0
        },
        "cache": {
          "x": 289,
          "y": 391,
          "w": 128,
          "h": 109,
          "ax": 64.0,
          "ay": 54.5,
          "r": 54.5
        },
        "sergei": {
          "x": 433,
          "y": 391,
          "w": 142,
          "h": 128,
          "ax": 71.0,
          "ay": 64.0,
          "r": 64.0
        }
      }
    },
    "gear": {
      "src": "assets/s3/gear.png",
      "items": {
        "smash": {
          "x": 1,
          "y": 1,
          "w": 173,
          "h": 108,
          "ax": 86.5,
          "ay": 54.0,
          "r": 54.0
        },
        "sergei": {
          "x": 189,
          "y": 1,
          "w": 186,
          "h": 151,
          "ax": 93.0,
          "ay": 75.5,
          "r": 75.5
        },
        "cargo": {
          "x": 377,
          "y": 1,
          "w": 171,
          "h": 152,
          "ax": 85.5,
          "ay": 76.0,
          "r": 76.0
        },
        "eagle": {
          "x": 565,
          "y": 1,
          "w": 158,
          "h": 187,
          "ax": 79.0,
          "ay": 93.5,
          "r": 79.0
        },
        "eagle2": {
          "x": 1,
          "y": 190,
          "w": 159,
          "h": 179,
          "ax": 79.5,
          "ay": 89.5,
          "r": 79.5
        },
        "spider": {
          "x": 189,
          "y": 190,
          "w": 122,
          "h": 108,
          "ax": 61.0,
          "ay": 54.0,
          "r": 54.0
        }
      }
    },
    "drones": {
      "src": "assets/s3/drones.png",
      "items": {
        "escort": {
          "x": 1,
          "y": 1,
          "w": 162,
          "h": 133,
          "ax": 81.0,
          "ay": 66.5,
          "r": 66.5
        },
        "kamikaze": {
          "x": 249,
          "y": 1,
          "w": 172,
          "h": 134,
          "ax": 86.0,
          "ay": 67.0,
          "r": 67.0
        },
        "expert": {
          "x": 497,
          "y": 1,
          "w": 246,
          "h": 173,
          "ax": 123.0,
          "ay": 86.5,
          "r": 86.5
        },
        "missile": {
          "x": 745,
          "y": 1,
          "w": 230,
          "h": 62,
          "ax": 115.0,
          "ay": 31.0,
          "r": 31.0
        }
      }
    },
    "support": {
      "src": "assets/s3/support.png",
      "items": {
        "shockdrone": {
          "x": 1,
          "y": 1,
          "w": 150,
          "h": 151,
          "ax": 67.8,
          "ay": 75.5,
          "r": 74.5
        },
        "shockdrone-zap": {
          "x": 217,
          "y": 1,
          "w": 214,
          "h": 151,
          "ax": 75.5,
          "ay": 75.5,
          "r": 74.5
        },
        "medbeacon": {
          "x": 433,
          "y": 1,
          "w": 116,
          "h": 116,
          "ax": 57.5,
          "ay": 58.0,
          "r": 57.0
        }
      }
    },
    "doll": {
      "src": "assets/s3/doll.png",
      "items": {
        "hoodie": {
          "x": 1,
          "y": 1,
          "w": 121,
          "h": 94,
          "ax": 52.4,
          "ay": 38.3,
          "r": 46.0,
          "hr": 25.4,
          "gx": 107.4,
          "gy": 45.9
        },
        "hoodie.c": {
          "x": 259,
          "y": 1,
          "w": 121,
          "h": 94,
          "ax": 52.4,
          "ay": 38.3,
          "r": 46.0
        },
        "hoodie.s": {
          "x": 517,
          "y": 1,
          "w": 121,
          "h": 94,
          "ax": 52.4,
          "ay": 38.3,
          "r": 46.0
        },
        "tee": {
          "x": 775,
          "y": 1,
          "w": 117,
          "h": 92,
          "ax": 46.0,
          "ay": 37.9,
          "r": 45.0,
          "hr": 25.0,
          "gx": 100.9,
          "gy": 45.2
        },
        "tee.c": {
          "x": 1033,
          "y": 1,
          "w": 117,
          "h": 92,
          "ax": 46.0,
          "ay": 37.9,
          "r": 45.0
        },
        "tee.s": {
          "x": 1291,
          "y": 1,
          "w": 117,
          "h": 92,
          "ax": 46.0,
          "ay": 37.9,
          "r": 45.0
        },
        "jacket": {
          "x": 1,
          "y": 104,
          "w": 115,
          "h": 94,
          "ax": 44.9,
          "ay": 38.6,
          "r": 46.0,
          "hr": 24.9,
          "gx": 101.0,
          "gy": 46.1
        },
        "jacket.c": {
          "x": 259,
          "y": 104,
          "w": 115,
          "h": 94,
          "ax": 44.9,
          "ay": 38.6,
          "r": 46.0
        },
        "jacket.s": {
          "x": 517,
          "y": 104,
          "w": 115,
          "h": 94,
          "ax": 44.9,
          "ay": 38.6,
          "r": 46.0
        },
        "hivis": {
          "x": 775,
          "y": 104,
          "w": 118,
          "h": 92,
          "ax": 47.1,
          "ay": 38.4,
          "r": 45.0,
          "hr": 24.9,
          "gx": 103.8,
          "gy": 45.9
        },
        "hivis.c": {
          "x": 1033,
          "y": 104,
          "w": 118,
          "h": 92,
          "ax": 47.1,
          "ay": 38.4,
          "r": 45.0
        },
        "hivis.s": {
          "x": 1291,
          "y": 104,
          "w": 118,
          "h": 92,
          "ax": 47.1,
          "ay": 38.4,
          "r": 45.0
        },
        "overalls": {
          "x": 1,
          "y": 207,
          "w": 121,
          "h": 95,
          "ax": 52.6,
          "ay": 38.6,
          "r": 46.5,
          "hr": 25.4,
          "gx": 107.0,
          "gy": 46.1
        },
        "overalls.c": {
          "x": 259,
          "y": 207,
          "w": 121,
          "h": 95,
          "ax": 52.6,
          "ay": 38.6,
          "r": 46.5
        },
        "overalls.s": {
          "x": 517,
          "y": 207,
          "w": 121,
          "h": 95,
          "ax": 52.6,
          "ay": 38.6,
          "r": 46.5
        },
        "suit": {
          "x": 775,
          "y": 207,
          "w": 117,
          "h": 96,
          "ax": 47.4,
          "ay": 38.7,
          "r": 46.5,
          "hr": 25.1,
          "gx": 103.4,
          "gy": 46.2
        },
        "suit.c": {
          "x": 1033,
          "y": 207,
          "w": 117,
          "h": 96,
          "ax": 47.4,
          "ay": 38.7,
          "r": 46.5
        },
        "suit.s": {
          "x": 1291,
          "y": 207,
          "w": 117,
          "h": 96,
          "ax": 47.4,
          "ay": 38.7,
          "r": 46.5
        },
        "waistcoat": {
          "x": 1,
          "y": 310,
          "w": 118,
          "h": 95,
          "ax": 48.0,
          "ay": 38.5,
          "r": 46.5,
          "hr": 25.3,
          "gx": 103.4,
          "gy": 46.1
        },
        "waistcoat.c": {
          "x": 259,
          "y": 310,
          "w": 118,
          "h": 95,
          "ax": 48.0,
          "ay": 38.5,
          "r": 46.5
        },
        "waistcoat.s": {
          "x": 517,
          "y": 310,
          "w": 118,
          "h": 95,
          "ax": 48.0,
          "ay": 38.5,
          "r": 46.5
        },
        "coat": {
          "x": 775,
          "y": 310,
          "w": 128,
          "h": 101,
          "ax": 56.1,
          "ay": 39.9,
          "r": 48.5,
          "hr": 25.3,
          "gx": 113.4,
          "gy": 47.7
        },
        "coat.c": {
          "x": 1033,
          "y": 310,
          "w": 128,
          "h": 101,
          "ax": 56.1,
          "ay": 39.9,
          "r": 48.5
        },
        "coat.s": {
          "x": 1291,
          "y": 310,
          "w": 128,
          "h": 101,
          "ax": 56.1,
          "ay": 39.9,
          "r": 48.5
        },
        "held-pistol": {
          "x": 1,
          "y": 413,
          "w": 83,
          "h": 66,
          "ax": 41.5,
          "ay": 33.0,
          "r": 33.0
        },
        "held-taser": {
          "x": 259,
          "y": 413,
          "w": 110,
          "h": 68,
          "ax": 55.0,
          "ay": 34.0,
          "r": 34.0
        },
        "held-shotgun": {
          "x": 517,
          "y": 413,
          "w": 201,
          "h": 53,
          "ax": 100.5,
          "ay": 26.5,
          "r": 26.5
        },
        "held-nailgun": {
          "x": 775,
          "y": 413,
          "w": 114,
          "h": 93,
          "ax": 57.0,
          "ay": 46.5,
          "r": 46.5
        },
        "held-silenced": {
          "x": 1033,
          "y": 413,
          "w": 140,
          "h": 64,
          "ax": 70.0,
          "ay": 32.0,
          "r": 32.0
        },
        "held-sledge": {
          "x": 1291,
          "y": 413,
          "w": 181,
          "h": 70,
          "ax": 90.5,
          "ay": 35.0,
          "r": 35.0
        },
        "held-rifle": {
          "x": 1,
          "y": 516,
          "w": 256,
          "h": 96,
          "ax": 128.0,
          "ay": 48.0,
          "r": 48.0
        },
        "held-carbine": {
          "x": 259,
          "y": 516,
          "w": 241,
          "h": 99,
          "ax": 120.5,
          "ay": 49.5,
          "r": 49.5
        }
      }
    }
  };
  S3.pictures = {
    "boss-bulldog": "assets/s3/boss-bulldog.jpg",
    "boss-carrier": "assets/s3/boss-carrier.jpg",
    "boss-keystone": "assets/s3/boss-keystone.jpg",
    "end-wipe": "assets/s3/end-wipe.jpg",
    "ev-aiden": "assets/s3/ev-aiden.jpg",
    "ev-bellwire": "assets/s3/ev-bellwire.jpg",
    "ev-coldchain": "assets/s3/ev-coldchain.jpg",
    "ev-darcy": "assets/s3/ev-darcy.jpg",
    "ev-giltfruit": "assets/s3/ev-giltfruit.jpg",
    "ev-haylift": "assets/s3/ev-haylift.jpg",
    "ev-hotwash": "assets/s3/ev-hotwash.jpg",
    "ev-lastferry": "assets/s3/ev-lastferry.jpg",
    "ev-nightbus": "assets/s3/ev-nightbus.jpg",
    "ev-sandglass": "assets/s3/ev-sandglass.jpg",
    "ev-seamstress": "assets/s3/ev-seamstress.jpg",
    "ev-tarot": "assets/s3/ev-tarot.jpg",
    "ev-wrench": "assets/s3/ev-wrench.jpg",
    "ev-yellowtag": "assets/s3/ev-yellowtag.jpg",
    "pt-elite-hitman": "assets/s3/pt-elite-hitman.jpg",
    "title": "assets/s3/title.jpg",
    "ev-marcus": "assets/s3/ev-marcus.jpg",
    "ev-bluedoor": "assets/s3/ev-bluedoor.jpg",
    "ev-cat": "assets/s3/ev-cat.jpg",
    "ev-vending": "assets/s3/ev-vending.jpg",
    "ev-terminal": "assets/s3/ev-terminal.jpg",
    "ev-courier": "assets/s3/ev-courier.jpg",
    "ev-dealer": "assets/s3/ev-dealer.jpg",
    "ev-bagley": "assets/s3/ev-bagley.jpg",
    "pt-bagley": "assets/s3/pt-bagley.jpg",
    "pt-echo": "assets/s3/pt-echo.jpg",
    "pt-maya": "assets/s3/pt-maya.jpg",
    "pt-harlow": "assets/s3/pt-harlow.jpg",
    "pt-keystone": "assets/s3/pt-keystone.jpg",
    "pt-hastings": "assets/s3/pt-hastings.jpg",
    "pt-kahn": "assets/s3/pt-kahn.jpg",
    "pt-hale": "assets/s3/pt-hale.jpg",
    "pt-cassie": "assets/s3/pt-cassie.jpg",
    "pt-elite-spy": "assets/s3/pt-elite-spy.jpg",
    "pt-elite-drone": "assets/s3/pt-elite-drone.jpg",
    "pt-elite-hooligan": "assets/s3/pt-elite-hooligan.jpg",
    "pt-elite-beekeeper": "assets/s3/pt-elite-beekeeper.jpg",
    "pt-elite-statue": "assets/s3/pt-elite-statue.jpg",
    "pt-elite-hypnotist": "assets/s3/pt-elite-hypnotist.jpg",
    "pt-elite-anarchist": "assets/s3/pt-elite-anarchist.jpg",
    "pt-elite-paramedic": "assets/s3/pt-elite-paramedic.jpg",
    "pt-elite-barrister": "assets/s3/pt-elite-barrister.jpg"
  };
})(window.ECHO = window.ECHO || {});
