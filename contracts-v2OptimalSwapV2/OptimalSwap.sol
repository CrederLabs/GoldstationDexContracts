pragma solidity =0.6.6;
pragma experimental ABIEncoderV2;

import "./interfaces/IOptimalSwap.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IWETH9.sol";

import "./libraries/SafeMath.sol";

// import "hardhat/console.sol";

contract OptimalSwap2 is IOptimalSwap {
    using SafeMath for uint;

    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Factory public immutable uniswapFactory;
    IWETH9 public immutable WETH;

    constructor(address _router, address _factory, address _WETH) public {
        uniswapRouter = IUniswapV2Router02(_router);
        uniswapFactory = IUniswapV2Factory(_factory);
        WETH = IWETH9(_WETH);
    }

    function getAmountOut(
        GetAmountOutParams memory params
    ) public pure returns (uint) {
        uint amountInWithFee = params.amountIn.mul(997);
        uint numerator = amountInWithFee.mul(params.reserveOut);
        uint denominator = params.reserveIn.mul(1000).add(amountInWithFee);
        return numerator / denominator;
    }

    function getReserves(
        GetReservesParams memory params
    ) internal view returns (uint r0, uint r1) {
        IUniswapV2Pair pair = IUniswapV2Pair(
            uniswapFactory.getPair(params.tokenA, params.tokenB)
        );
        (r0, r1, ) = pair.getReserves();
    }

    function createPath(
        CreatePathParams memory params
    ) internal pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = params.fromToken;
        path[1] = params.toToken;
        return path;
    }

    function swap(SwapParams memory params) internal {
        uniswapRouter.swapExactTokensForTokens(
            params.optSwapAmount,
            params.optSwapAmountOutMin,
            params.path,
            params.to,
            params.deadline
        );
    }

    function getExpectedAmounts(
        GetExpectedAmountsParams calldata params
    )
        external
        view
        override
        returns (GetExpectedAmountsReturn memory returnVal)
    {
        IUniswapV2Pair pair = IUniswapV2Pair(
            uniswapFactory.getPair(params._fromToken, params._toToken)
        );
        address t0 = pair.token0();
        (uint r0, uint r1) = getReserves(
            GetReservesParams({
                tokenA: params._fromToken,
                tokenB: params._toToken
            })
        );
        // same as fromTokenBalance
        uint half = params.amountDesired / 2;
        // same as toTokenBalance
        uint amountOut = uniswapRouter.getAmountOut(
            half,
            params._fromToken == t0 ? r0 : r1,
            params._fromToken == t0 ? r1 : r0
        );
        uint newR0;
        uint newR1;
        if (params._fromToken == t0) {
            newR0 = r0 + half;
            newR1 = r1 - amountOut;
        } else {
            newR0 = r0 - amountOut;
            newR1 = r1 + half;
        }

        uint toTokenAmountIn = half.mul(
            params._fromToken == t0 ? newR1 : newR0
        ) / (params._fromToken == t0 ? newR0 : newR1);
        uint fromTokenAmountIn = amountOut.mul(
            params._toToken == t0 ? newR1 : newR0
        ) / (params._toToken == t0 ? newR0 : newR1);

        // if max [fromToken] is available
        if (toTokenAmountIn <= amountOut) {
            returnVal = GetExpectedAmountsReturn(
                half,
                toTokenAmountIn,
                0,
                amountOut.sub(toTokenAmountIn)
            );
        }
        // if max [toToken] is available
        else {
            returnVal = GetExpectedAmountsReturn(
                fromTokenAmountIn,
                amountOut,
                half.sub(fromTokenAmountIn),
                0
            );
        }
    }

    function addLiquidity(
        AddLiquidityParams memory params
    ) internal returns (uint amountA, uint amountB, uint liquidity) {
        return
            uniswapRouter.addLiquidity(
                params.tokenA,
                params.tokenB,
                params.amountInputDesired,
                params.amountTokenB,
                params.amountInputDesired.mul(10000 - params.slippage) / 10000,
                params.amountTokenB.mul(10000 - params.slippage) / 10000,
                params.to,
                params.deadline
            );
    }

    function swapAndAddLiquidity(
        SwapAndAddLiquidityParams calldata params
    ) external override returns (uint amountA, uint amountB, uint liquidity) {
        require(
            params.toToken != address(WETH),
            "OptimalSwap: INVALID_TO_TOKEN"
        );
        require(
            params.fromToken != params.toToken,
            "OptimalSwap: IDENTICAL_ADDRESSES"
        );
        require(
            uniswapFactory.getPair(params.fromToken, params.toToken) !=
                address(0),
            "OptimalSwap: PAIR_NOT_FOUND"
        );
        require(
            params.amountInputDesired > 0,
            "OptimalSwap: INSUFFICIENT_INPUT_AMOUNT"
        );

        // transfer token to this contract
        IERC20 fromToken = IERC20(params.fromToken);
        fromToken.transferFrom(
            msg.sender,
            address(this),
            params.amountInputDesired
        );

        // swap
        fromToken.approve(
            address(uniswapRouter),
            params.amountInputDesired / 2
        );

        // get token0 and token1
        (address t0, ) = params.fromToken < params.toToken
            ? (params.fromToken, params.toToken)
            : (params.toToken, params.fromToken);
        swap(
            SwapParams({
                optSwapAmount: params.amountInputDesired / 2,
                optSwapAmountOutMin: params.swapAmountOutMin,
                path: createPath(
                    CreatePathParams({
                        fromToken: params.fromToken,
                        toToken: params.toToken
                    })
                ),
                to: address(this),
                deadline: params.deadline
            })
        );

        // get reserves
        (uint r0, uint r1) = getReserves(
            GetReservesParams({
                tokenA: params.fromToken,
                tokenB: params.toToken
            })
        );

        // get which tokens amount to add liquidity is available
        uint toTokenBalance = IERC20(params.toToken).balanceOf(address(this));
        uint fromTokenBalance = IERC20(params.fromToken).balanceOf(
            address(this)
        );
        uint toTokenAmount = fromTokenBalance.mul(
            params.fromToken == t0 ? r1 : r0
        ) / (params.fromToken == t0 ? r0 : r1);
        uint fromTokenAmount = toTokenBalance.mul(
            params.toToken == t0 ? r1 : r0
        ) / (params.toToken == t0 ? r0 : r1);

        // when max [toToken] is available
        if (fromTokenAmount <= fromTokenBalance) {
            IERC20(params.fromToken).approve(
                address(uniswapRouter),
                fromTokenAmount
            );
            IERC20(params.toToken).approve(
                address(uniswapRouter),
                toTokenBalance
            );
            // add liquidity
            (amountA, amountB, liquidity) = addLiquidity(
                AddLiquidityParams({
                    tokenA: t0 == params.fromToken
                        ? params.fromToken
                        : params.toToken,
                    tokenB: t0 == params.fromToken
                        ? params.toToken
                        : params.fromToken,
                    amountInputDesired: t0 == params.fromToken
                        ? fromTokenAmount
                        : toTokenBalance,
                    amountTokenB: t0 == params.fromToken
                        ? toTokenBalance
                        : fromTokenAmount,
                    slippage: params.slippage,
                    to: params.to,
                    deadline: params.deadline
                })
            );
            // transfer remain token to msg.sender
            IERC20(params.fromToken).transfer(
                msg.sender,
                fromTokenBalance.sub(fromTokenAmount)
            );
            return (amountA, amountB, liquidity);
        }
        // when max [fromToken] is available
        else if (toTokenAmount <= toTokenBalance) {
            IERC20(params.fromToken).approve(
                address(uniswapRouter),
                fromTokenBalance
            );
            IERC20(params.toToken).approve(
                address(uniswapRouter),
                toTokenAmount
            );
            // add liquidity
            (amountA, amountB, liquidity) = addLiquidity(
                AddLiquidityParams({
                    tokenA: t0 == params.fromToken
                        ? params.fromToken
                        : params.toToken,
                    tokenB: t0 == params.fromToken
                        ? params.toToken
                        : params.fromToken,
                    amountInputDesired: t0 == params.fromToken
                        ? fromTokenBalance
                        : toTokenAmount,
                    amountTokenB: t0 == params.fromToken
                        ? toTokenAmount
                        : fromTokenBalance,
                    slippage: params.slippage,
                    to: params.to,
                    deadline: params.deadline
                })
            );
            // transfer remain token to msg.sender
            IERC20(params.toToken).transfer(
                msg.sender,
                toTokenBalance.sub(toTokenAmount)
            );
            return (amountA, amountB, liquidity);
        } else {
            revert("OptimalSwap: INSUFFICIENT_BALANCE");
        }
    }

    function swapAndAddLiquidityFromETH(
        SwapAndAddLiquidityParamsFromETH calldata params
    )
        external
        payable
        override
        returns (uint amountA, uint amountB, uint liquidity)
    {
        require(
            params.toToken != address(WETH),
            "OptimalSwap: INVALID_TO_TOKEN"
        );
        require(
            address(WETH) != params.toToken,
            "OptimalSwap: IDENTICAL_ADDRESSES"
        );
        require(
            uniswapFactory.getPair(address(WETH), params.toToken) != address(0),
            "OptimalSwap: PAIR_NOT_FOUND"
        );
        require(msg.value > 0, "OptimalSwap: INSUFFICIENT_INPUT_AMOUNT");

        // @notice fromToken is WETH
        uint half = msg.value / 2;
        WETH.deposit{value: msg.value}();

        // swap
        WETH.approve(address(uniswapRouter), half);
        swap(
            SwapParams({
                optSwapAmount: half,
                optSwapAmountOutMin: params.swapAmountOutMin,
                path: createPath(
                    CreatePathParams({
                        fromToken: address(WETH),
                        toToken: params.toToken
                    })
                ),
                to: address(this),
                deadline: params.deadline
            })
        );

        // get token0 and token1
        IUniswapV2Pair pair = IUniswapV2Pair(
            uniswapFactory.getPair(address(WETH), params.toToken)
        );
        address t0 = pair.token0();

        // get reserves
        (uint r0, uint r1) = getReserves(
            GetReservesParams({tokenA: address(WETH), tokenB: params.toToken})
        );

        // get which tokens amount to add liquidity is available
        uint toTokenBalance = IERC20(params.toToken).balanceOf(address(this));
        uint fromTokenBalance = WETH.balanceOf(address(this));
        uint toTokenAmount = fromTokenBalance.mul(
            address(WETH) == t0 ? r1 : r0
        ) / (address(WETH) == t0 ? r0 : r1);
        uint fromTokenAmount = toTokenBalance.mul(
            params.toToken == t0 ? r1 : r0
        ) / (params.toToken == t0 ? r0 : r1);

        // when max [toToken] is available
        if (fromTokenAmount <= fromTokenBalance) {
            WETH.approve(address(uniswapRouter), fromTokenAmount);
            IERC20(params.toToken).approve(
                address(uniswapRouter),
                toTokenBalance
            );
            // add liquidity
            (amountA, amountB, liquidity) = addLiquidity(
                AddLiquidityParams({
                    tokenA: t0 == address(WETH)
                        ? address(WETH)
                        : params.toToken,
                    tokenB: t0 == address(WETH)
                        ? params.toToken
                        : address(WETH),
                    amountInputDesired: t0 == address(WETH)
                        ? fromTokenAmount
                        : toTokenBalance,
                    amountTokenB: t0 == address(WETH)
                        ? toTokenBalance
                        : fromTokenAmount,
                    slippage: params.slippage,
                    to: params.to,
                    deadline: params.deadline
                })
            );
            // transfer remain token to msg.sender
            WETH.withdraw(fromTokenBalance.sub(fromTokenAmount));
            payable(msg.sender).transfer(fromTokenBalance.sub(fromTokenAmount));
            return (amountA, amountB, liquidity);
        }
        // when max [WETH] is available
        else if (toTokenAmount <= toTokenBalance) {
            WETH.approve(address(uniswapRouter), fromTokenBalance);
            IERC20(params.toToken).approve(
                address(uniswapRouter),
                toTokenAmount
            );
            // add liquidity
            (amountA, amountB, liquidity) = addLiquidity(
                AddLiquidityParams({
                    tokenA: t0 == address(WETH)
                        ? address(WETH)
                        : params.toToken,
                    tokenB: t0 == address(WETH)
                        ? params.toToken
                        : address(WETH),
                    amountInputDesired: t0 == address(WETH)
                        ? fromTokenBalance
                        : toTokenAmount,
                    amountTokenB: t0 == address(WETH)
                        ? toTokenAmount
                        : fromTokenBalance,
                    slippage: params.slippage,
                    to: params.to,
                    deadline: params.deadline
                })
            );
            // transfer remain token to msg.sender
            IERC20(params.toToken).transfer(
                msg.sender,
                toTokenBalance.sub(toTokenAmount)
            );
            return (amountA, amountB, liquidity);
        } else {
            revert("OptimalSwap: INSUFFICIENT_BALANCE");
        }
    }

    receive() external payable {
        require(msg.sender == address(WETH), "Only WETH contract can send ETH");
    }

    function swapAndAddLiquidityToETH(
        SwapAndAddLiquidityParamsToETH calldata params
    ) external override returns (uint amountA, uint amountB, uint liquidity) {
        require(
            params.fromToken != address(WETH),
            "OptimalSwap: INVALID_FROM_TOKEN"
        );
        require(
            uniswapFactory.getPair(address(WETH), params.fromToken) !=
                address(0),
            "OptimalSwap: PAIR_NOT_FOUND"
        );
        require(
            params.amountInputDesired > 0,
            "OptimalSwap: INSUFFICIENT_INPUT_AMOUNT"
        );

        // @notice toToken is WETH
        // uint half = params.amountInputDesired / 2
        IERC20 fromToken = IERC20(params.fromToken);
        fromToken.transferFrom(
            msg.sender,
            address(this),
            params.amountInputDesired
        );

        // swap
        fromToken.approve(
            address(uniswapRouter),
            params.amountInputDesired / 2
        );
        swap(
            SwapParams({
                optSwapAmount: params.amountInputDesired / 2,
                optSwapAmountOutMin: params.swapAmountOutMin,
                path: createPath(
                    CreatePathParams({
                        fromToken: params.fromToken,
                        toToken: address(WETH)
                    })
                ),
                to: address(this),
                deadline: params.deadline
            })
        );

        // get token0 and token1
        IUniswapV2Pair pair = IUniswapV2Pair(
            uniswapFactory.getPair(address(WETH), params.fromToken)
        );
        address t0 = pair.token0();

        // get reserves
        (uint r0, uint r1) = getReserves(
            GetReservesParams({tokenA: address(WETH), tokenB: params.fromToken})
        );

        // get which tokens amount to add liquidity is available
        uint toTokenBalance = WETH.balanceOf(address(this));
        uint fromTokenBalance = IERC20(params.fromToken).balanceOf(
            address(this)
        );
        uint toTokenAmount = fromTokenBalance.mul(
            address(fromToken) == t0 ? r1 : r0
        ) / (address(fromToken) == t0 ? r0 : r1);
        uint fromTokenAmount = toTokenBalance.mul(
            address(WETH) == t0 ? r1 : r0
        ) / (address(WETH) == t0 ? r0 : r1);

        // when max [toToken(WETH)] is available
        if (fromTokenAmount <= fromTokenBalance) {
            WETH.approve(address(uniswapRouter), toTokenBalance);
            fromToken.approve(address(uniswapRouter), fromTokenAmount);
            // add liquidity
            (amountA, amountB, liquidity) = addLiquidity(
                AddLiquidityParams({
                    tokenA: t0 == address(WETH)
                        ? address(WETH)
                        : params.fromToken,
                    tokenB: t0 == address(WETH)
                        ? params.fromToken
                        : address(WETH),
                    amountInputDesired: t0 == address(WETH)
                        ? toTokenBalance
                        : fromTokenAmount,
                    amountTokenB: t0 == address(WETH)
                        ? fromTokenAmount
                        : toTokenBalance,
                    slippage: params.slippage,
                    to: params.to,
                    deadline: params.deadline
                })
            );
            // transfer remain token to msg.sender
            fromToken.transfer(
                msg.sender,
                fromTokenBalance.sub(fromTokenAmount)
            );
            return (amountA, amountB, liquidity);
        }
        // when max [fromToken] is available
        else if (toTokenAmount <= toTokenBalance) {
            IERC20(params.fromToken).approve(
                address(uniswapRouter),
                fromTokenBalance
            );
            WETH.approve(address(uniswapRouter), toTokenAmount);
            // add liquidity
            (amountA, amountB, liquidity) = addLiquidity(
                AddLiquidityParams({
                    tokenA: t0 == address(WETH)
                        ? address(WETH)
                        : params.fromToken,
                    tokenB: t0 == address(WETH)
                        ? params.fromToken
                        : address(WETH),
                    amountInputDesired: t0 == address(WETH)
                        ? toTokenAmount
                        : fromTokenBalance,
                    amountTokenB: t0 == address(WETH)
                        ? fromTokenBalance
                        : toTokenAmount,
                    slippage: params.slippage,
                    to: params.to,
                    deadline: params.deadline
                })
            );
            // transfer remaining token(WETH) to msg.sender
            WETH.withdraw(toTokenBalance.sub(toTokenAmount));
            payable(msg.sender).transfer(toTokenBalance.sub(toTokenAmount));
            return (amountA, amountB, liquidity);
        } else {
            revert("OptimalSwap: INSUFFICIENT_BALANCE");
        }
    }
}
