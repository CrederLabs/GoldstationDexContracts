# Goldstation V2

This Repository is forked from [Uniswap Labs](https://github.com/Uniswap)

- UniswapV2Core : https://github.com/Uniswap/v2-core
- UniswapV2Periphery : https://github.com/Uniswap/v2-periphery

# URL

[Swap](https://goldstation.io/exchange/swap)

[Liquidity](https://goldstation.io/pool/v2)

# Factory Contract Address

`0x347E5ce6764DF9DF85487BEA523D3e242762aE88`

# Router Contract Address

`0x4Dee8682951256f76499e75d60BFB5EDD2347fbC`

# Optimal Swap Contract Address

~~0x1AdbD7F2b8F7A223cC17ee2f8b20fBdbA851E2Ad~~(will be redeployed)

# Pair Addresses

- KLAY-GPC : `0xCd13CD31fb61345Abe7B7376A4664784622817EE`
- GPC-GHUB : `0xf1294aa9Cf51Fb138cb30324d2A7CE5C53dD6876`
- GHUB-GXA: `0xd8219DEE0bEF8f8ce618572A572f87ea27AC8285`
- KLAY-GHUB: `0xf2426f8B8Cb0352Fd03319300b6d4D6837915d45`
- GPC-WDIGAU: `0xB5e70F160077163a2D90F4828EF2eFF7e5f57915`

# Token Addresses

- GPC : `0x27397bFbeFD58A437f2636f80A8e70cFc363d4Ff`
- GHUB : `0x4836cC1f355bB2A61c210EAA0CD3f729160CD95E`
- GXA : `0xA80e96cCeB1419f9BD9F1c67F7978F51b534A11b`
- WDIGAU : `0x8E4F795c22629777D7206131fAfe266dDf062C76`

# Public APIs for summary

> API Host : https://api-hk.goldstation.io

## 🔗[GET] /public/v2/uniswap

> return summary data of entire pair pools

response example

```json
{
    "0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432_0x27397bFbeFD58A437f2636f80A8e70cFc363d4Ff": {
        "base_id": "0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432",
        "base_name": "Wrapped Klay",
        "base_symbol": "WKLAY",
        "quote_id": "0x27397bFbeFD58A437f2636f80A8e70cFc363d4Ff",
        "quote_name": "Gold Pegged Coin",
        "quote_symbol": "GPC",
        "last_price": "0.23574130775377183519",
        "base_volume": "1294561.616281642567915309",
        "quote_volume": "305181.648390070984341338"
    },
    "0x27397bFbeFD58A437f2636f80A8e70cFc363d4Ff_0x4836cC1f355bB2A61c210EAA0CD3f729160CD95E": {
        "base_id": "0x27397bFbeFD58A437f2636f80A8e70cFc363d4Ff",
        "base_name": "Gold Pegged Coin",
        "base_symbol": "GPC",
        "quote_id": "0x4836cC1f355bB2A61c210EAA0CD3f729160CD95E",
        "quote_name": "GemHUB",
        "quote_symbol": "GHUB",
        "last_price": "11.84077689693112563916",
        "base_volume": "160723.063478353103034823",
        "quote_volume": "1903085.936838478183753853"
    },
		...
}
```

## 🔗[GraphQL] /public/v2/graphql

> return swap data

Query Schema

```graphql
swaps(first: Int, last: Int, orderBy : OrderBy): [Swap]
```

Request

```graphql
{
  swaps(first: 3, orderBy: timestamp) {
    id
    fromAmount
    toAmount
    timestamp
    pair {
      fromToken {
        decimals
        symbol
        tradeVolume
      }
      toToken {
        decimals
        symbol
        tradeVolume
      }
    }
  }
}
```

Response

```json
{
  "data": {
    "swaps": [
      {
        "id": "0xaa02166d6e4011a5339cf5bbd01aee3becf04ddbebec8480aa081b79a5c7a509",
        "fromAmount": "681818181818181818182",
        "toAmount": "162283116177419612165",
        "timestamp": 1715933615,
        "pair": {
          "fromToken": {
            "decimals": 18,
            "symbol": "WKLAY",
            "tradeVolume": "3171.381196022355815364"
          },
          "toToken": {
            "decimals": 18,
            "symbol": "GPC",
            "tradeVolume": "3384.083332003214858968"
          }
        }
      },
      {
        "id": "0xaa02166d6e4011a5339cf5bbd01aee3becf04ddbebec8480aa081b79a5c7a509",
        "fromAmount": "194845290263247290331",
        "toAmount": "16227234997854022081",
        "timestamp": 1715933615,
        "pair": {
          "fromToken": {
            "decimals": 18,
            "symbol": "GHUB",
            "tradeVolume": "1932.710298977311574251"
          },
          "toToken": {
            "decimals": 18,
            "symbol": "GPC",
            "tradeVolume": "3384.083332003214858968"
          }
        }
      },
      ...
    ]
  }
}
```

## 🔗[GET] /public/v2/yieldFarming

> return summary data of farming contract

Response

```json
{
    "provider": "GoldStation",
    "provider_logo": "https://goldstation.io/tokens/gpc.png",
    "provider_URL": "https://goldstation.io/",
    "links": [
        {
            "title": "Twitter",
            "link": "https://twitter.com/goldstation_io"
        },
        {
            "title": "Telegram",
            "link": "https://t.me/official_goldstation"
        },
        {
            "title": "Discord",
            "link": "https://discord.gg/goldstation"
        }
    ],
    "pools": [
        {
            "name": "Gold-Pegged Coin + WDIGAU",
            "pair": "GPC-WDIGAU",
            "pairLink": "https://goldstation.io/pool/v2/myinfo/0xB5e70F160077163a2D90F4828EF2eFF7e5f57915",
            "logo": "https://goldstation.io/pool/v2/gpcWdigau.png",
            "poolRewards": [
                "GHUB"
            ],
            "apr": "36.81",
            "totalStaked": "186906.977910430566130859"
        },
        {
            "name": "Klaytn + Gold-Pegged Coin",
            "pair": "KLAY-GPC",
            "pairLink": "https://goldstation.io/pool/v2/myinfo/0xCd13CD31fb61345Abe7B7376A4664784622817EE",
            "logo": "https://goldstation.io/pool/v2/klayGpc.png",
            "poolRewards": [
                "GHUB"
            ],
            "apr": "32.89",
            "totalStaked": "449484.580645012436826708"
        },
        ...
    ]
}
```
