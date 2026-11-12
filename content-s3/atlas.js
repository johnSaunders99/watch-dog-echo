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
    }
  };
  S3.pictures = {
    "boss-bulldog": "assets/s3/boss-bulldog.jpg",
    "boss-carrier": "assets/s3/boss-carrier.jpg",
    "boss-keystone": "assets/s3/boss-keystone.jpg",
    "title": "assets/s3/title.jpg",
    "ev-wrench": "assets/s3/ev-wrench.jpg",
    "ev-darcy": "assets/s3/ev-darcy.jpg",
    "ev-aiden": "assets/s3/ev-aiden.jpg",
    "ev-marcus": "assets/s3/ev-marcus.jpg",
    "ev-bluedoor": "assets/s3/ev-bluedoor.jpg",
    "ev-cat": "assets/s3/ev-cat.jpg",
    "ev-tarot": "assets/s3/ev-tarot.jpg",
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
    "pt-cassie": "assets/s3/pt-cassie.jpg"
  };
})(window.ECHO = window.ECHO || {});
