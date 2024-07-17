// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IOptimalSwap {
    struct SwapAndAddLiquidityParams {
        address fromToken;
        address toToken;
        uint amountInputDesired;
        uint swapAmountOutMin;
        uint slippage;
        address to;
        uint deadline;
    }

    struct SwapAndAddLiquidityParamsFromETH {
        // @notice fromToken is WETH
        // address fromToken;
        address toToken;
        // @notice amountInputDesired is msg.value
        // uint amountInputDesired;
        uint swapAmountOutMin;
        uint slippage;
        address to;
        uint deadline;
    }

    struct SwapAndAddLiquidityParamsToETH {
        address fromToken;
        // @notice toToken is WETH
        // address toToken;
        uint amountInputDesired;
        uint swapAmountOutMin;
        uint slippage;
        address to;
        uint deadline;
    }

    struct Reseult {
        uint amountA;
        uint amountB;
        uint liquidity;
    }

    struct AddLiquidityParams {
        address tokenA;
        address tokenB;
        uint amountInputDesired;
        uint amountTokenB;
        uint slippage;
        address to;
        uint deadline;
    }

    struct SwapParams {
        uint optSwapAmount;
        uint optSwapAmountOutMin;
        address[] path;
        address to;
        uint deadline;
    }

    struct GetReservesParams {
        address tokenA;
        address tokenB;
    }

    struct CreatePathParams {
        address fromToken;
        address toToken;
    }

    struct GetAmountOutParams {
        uint amountIn;
        uint reserveIn;
        uint reserveOut;
    }

    struct GetOptSwapAmountParams {
        uint amountInDesired;
        uint reserveIn;
    }

    function swapAndAddLiquidity(
        SwapAndAddLiquidityParams calldata params
    ) external returns (uint, uint, uint);

    function swapAndAddLiquidityFromETH(
        SwapAndAddLiquidityParamsFromETH calldata params
    ) external payable returns (uint amountA, uint amountB, uint liquidity);

    function swapAndAddLiquidityToETH(
        SwapAndAddLiquidityParamsToETH calldata params
    ) external returns (uint amountA, uint amountB, uint liquidity);
}
