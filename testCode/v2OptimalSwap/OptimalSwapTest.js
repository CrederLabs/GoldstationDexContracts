const { expect } = require("chai");
const b = require("bignumber.js");

describe("OptimalSwap", function () {
  let deployer;
  let user1;

  let factoryContract;
  let routerContract;
  let token0Contract;
  let token1Contract;
  let pairContract;
  let optimalSwapContract;
  let WETHContract;

  const initReserve0 = `1242768.842601976080876123`;
  const initReserve1 = `254759.804859187099903933`;
  const desiredSwapAmount = `10000`;

  const initReserveETH = `1`;
  const initReserve0_2 = `50`;
  const desiredSwapAmountETH = `10`;

  before(async function () {
    [deployer, user1] = await ethers.getSigners();
    const factoryF = await ethers.getContractFactory("UniswapV2Factory");
    factoryContract = await factoryF.deploy(deployer.address);
    const initCodeHash = await factoryContract.INIT_CODE_HASH();

    const WETHF = await ethers.getContractFactory("WETH");
    WETHContract = await WETHF.deploy();

    const routerF = await ethers.getContractFactory("UniswapV2Router02");
    routerContract = await routerF.deploy(
      factoryContract.target,
      WETHContract.target
    );

    const tokenF = await ethers.getContractFactory("FERC20");
    token0Contract = await tokenF.deploy("t1", "Token1");
    token1Contract = await tokenF.deploy("t2", "Token2");

    if (token0Contract.target > token1Contract.target) {
      [token0Contract, token1Contract] = [token1Contract, token0Contract];
    }
    const optimalSwapF = await ethers.getContractFactory("OptimalSwap2");
    optimalSwapContract = await optimalSwapF.deploy(
      routerContract.target,
      factoryContract.target,
      WETHContract.target
    );
  });

  describe("Load Environment", function () {
    it("Deployer Should be loaded", async function () {
      expect(deployer.address).to.properAddress;
    });
    it("Factory contract Should be deployed", async function () {
      expect(factoryContract.target).to.properAddress;
    });
    it("Router contract Should be deployed", async function () {
      expect(routerContract.target).to.properAddress;
    });
  });

  describe("Deploy Tokens", function () {
    it("Token0 Should be deployed", async function () {
      expect(token0Contract.target).to.properAddress;
    });
    it("Token1 Should be deployed", async function () {
      expect(token1Contract.target).to.properAddress;
    });
  });

  describe("Create Pair", function () {
    it("Should create pair", async function () {
      await factoryContract.createPair(
        token0Contract.target,
        token1Contract.target
      );
      const pairAddress = await factoryContract.getPair(
        token0Contract.target,
        token1Contract.target
      );
      const pairF = await ethers.getContractFactory("UniswapV2Pair");
      pairContract = await pairF.attach(pairAddress);
      expect(pairContract.target).not.to.equal(ethers.ZeroAddress);
    });
  });

  describe("Pair should have token reserves", function () {
    it("Token reserve should be 0", async function () {
      const [reserves0, reserves1] = await pairContract.getReserves();
      expect(reserves0).to.equal(0);
      expect(reserves1).to.equal(0);
    });

    it("Deployer Should have enough tokens", async function () {
      const token0Deployer = await token0Contract.connect(deployer);

      const token0Amount = ethers.parseEther(initReserve0);
      await token0Deployer.faucet(token0Amount);
      const token0DeployerBalance = await token0Deployer.balanceOf(
        deployer.address
      );
      expect(token0DeployerBalance).to.equal(token0Amount);

      const token1Deployer = await token1Contract.connect(deployer);
      const token1Amount = ethers.parseEther(initReserve1);
      await token1Deployer.faucet(token1Amount);
      const token1DeployerBalance = await token1Deployer.balanceOf(
        deployer.address
      );
      expect(token1DeployerBalance).to.equal(token1Amount);
    });

    it("Deployer Should approve router", async function () {
      const token0Deployer = await token0Contract.connect(deployer);
      const token1Deployer = await token1Contract.connect(deployer);
      const approveAmount = ethers.parseEther("999999999999999");
      await token0Deployer.approve(routerContract.target, approveAmount);
      await token1Deployer.approve(routerContract.target, approveAmount);
      const token0Allowance = await token0Deployer.allowance(
        deployer.address,
        routerContract.target
      );
      const token1Allowance = await token1Deployer.allowance(
        deployer.address,
        routerContract.target
      );
      expect(token0Allowance).to.equal(approveAmount);
      expect(token1Allowance).to.equal(approveAmount);
    });

    it(`Add Liquidity : Token0(${initReserve0}) Token1(${initReserve1})`, async function () {
      const routerDeployer = await routerContract.connect(deployer);
      const token0Amount = ethers.parseEther(initReserve0);
      const token1Amount = ethers.parseEther(initReserve1);
      await routerDeployer.addLiquidity(
        token0Contract.target,
        token1Contract.target,
        token0Amount,
        token1Amount,
        0,
        0,
        deployer.address,
        Date.now() + 60 * 1000 * 10
      );

      const [reserves0, reserves1] = await pairContract.getReserves();
      expect(reserves0).to.equal(token0Amount);
      expect(reserves1).to.equal(token1Amount);
    });
  });

  describe("Faucet Tokens", function () {
    it("Balance of Token0 Should be 0", async function () {
      const token0User1 = await token0Contract.connect(user1);
      const token0User1Balance = await token0User1.balanceOf(user1.address);
      expect(token0User1Balance).to.equal(0);
    });
    it("Balance of Token1 Should be 0", async function () {
      const token1User1 = await token1Contract.connect(user1);
      const token1User1Balance = await token1User1.balanceOf(user1.address);
      expect(token1User1Balance).to.equal(0);
    });
    it("Faucet Token0 to User1", async function () {
      const token0User1 = await token0Contract.connect(user1);
      await token0User1.faucet(ethers.parseEther(desiredSwapAmount));
      const token0User1Balance = await token0User1.balanceOf(user1.address);
      expect(token0User1Balance).to.equal(ethers.parseEther(desiredSwapAmount));
    });
  });

  describe("💫Swap And Add Liquidity (Token0 -> Token1)", function () {
    it("Should Approve to optimal swap contract", async function () {
      const token0User1 = await token0Contract.connect(user1);
      const approveAmount = ethers.parseEther(desiredSwapAmount);
      console.log(`User1's tx : token approve`);
      await token0User1.approve(optimalSwapContract.target, approveAmount);
      expect(
        await token0User1.allowance(user1.address, optimalSwapContract.target)
      ).to.equal(approveAmount);
    });
    it("Should Swap Token0 to Token1 And add liquidity simultaneously", async function () {
      const optimalSwapUser1 = await optimalSwapContract.connect(user1);

      const token0Address = token0Contract.target;
      const token1Address = token1Contract.target;
      const amount = ethers.parseEther(desiredSwapAmount);
      const slippage = 50;
      const deadline = Date.now() + 60 * 1000 * 10;
      const [r0B, r1B] = await pairContract.getReserves();
      const t0BBal = ethers.formatEther(
        await token0Contract.balanceOf(user1.address)
      );
      const t1BBal = ethers.formatEther(
        await token1Contract.balanceOf(user1.address)
      );

      console.log(`User1's tx : call swapAndAddLiquidity`);
      const amountOut = await routerContract.getAmountOut(
        new b(amount).div(2).integerValue().toFixed(),
        r0B,
        r1B
      );
      const swapAmountOutMin = new b(amountOut)
        .times(10000 - slippage)
        .div(10000)
        .integerValue()
        .toFixed();
      const tx = await optimalSwapUser1.swapAndAddLiquidity({
        fromToken: token0Address,
        toToken: token1Address,
        amountInputDesired: amount,
        swapAmountOutMin,
        slippage,
        to: user1.address,
        deadline,
      });
      await tx.wait();
      const lpUser1Balance = await pairContract.balanceOf(user1.address);

      const [r0A, r1A] = await pairContract.getReserves();
      const t0ABal = ethers.formatEther(
        await token0Contract.balanceOf(user1.address)
      );
      const t1ABal = ethers.formatEther(
        await token1Contract.balanceOf(user1.address)
      );

      console.log(`User1's token0 balance: ${t0BBal} => ${t0ABal}`);
      console.log(`User1's token1 balance: ${t1BBal} => ${t1ABal}`);
      console.log(
        `Reserve0 : ${ethers.formatEther(r0B)} => ${ethers.formatEther(
          r0A
        )} (diff : ${new b(r0A).minus(r0B).abs().div(1e18).toString()})`
      );
      console.log(
        `Reserve1 : ${ethers.formatEther(r1B)} => ${ethers.formatEther(
          r1A
        )} (diff : ${new b(r1A).minus(r1B).abs().div(1e18).toString()})`
      );
      expect(lpUser1Balance).not.to.equal(0);
    });
  });

  describe("Burn remaining Tokens", function () {
    it("Should burn remaining tokens", async function () {
      const token0User1 = await token0Contract.connect(user1);
      const token1User1 = await token1Contract.connect(user1);
      const token0Bal = await token0User1.balanceOf(user1.address);
      const token1Bal = await token1User1.balanceOf(user1.address);
      if (token0Bal > 0n) {
        await token0User1.transfer(ethers.ZeroAddress, token0Bal);
      }
      if (token1Bal > 0n) {
        await token1User1.transfer(ethers.ZeroAddress, token1Bal);
      }
      const token0BalA = await token0User1.balanceOf(user1.address);
      const token1BalA = await token1User1.balanceOf(user1.address);
      expect(token0BalA).to.equal(0);
      expect(token1BalA).to.equal(0);
    });
  });

  describe("Faucet Tokens", function () {
    it("Balance of Token0 Should be 0", async function () {
      const token0User1 = await token0Contract.connect(user1);
      const token0User1Balance = await token0User1.balanceOf(user1.address);
      expect(token0User1Balance).to.equal(0);
    });
    it("Balance of Token1 Should be 0", async function () {
      const token1User1 = await token1Contract.connect(user1);
      const token1User1Balance = await token1User1.balanceOf(user1.address);
      expect(token1User1Balance).to.equal(0);
    });
    it("Faucet Token1 to User1", async function () {
      const token1User1 = await token1Contract.connect(user1);
      await token1User1.faucet(ethers.parseEther(desiredSwapAmount));
      const token1User1Balance = await token1User1.balanceOf(user1.address);
      expect(token1User1Balance).to.equal(ethers.parseEther(desiredSwapAmount));
    });
  });

  describe("💫Swap And Add Liquidity (Token1 -> Token0)", function () {
    it("Should Approve to optimal swap contract", async function () {
      const token1User1 = await token1Contract.connect(user1);
      const approveAmount = ethers.parseEther(desiredSwapAmount);
      console.log(`User1's tx : token approve`);
      await token1User1.approve(optimalSwapContract.target, approveAmount);
      expect(
        await token1User1.allowance(user1.address, optimalSwapContract.target)
      ).to.equal(approveAmount);
    });
    it("Should Swap Token0 to Token1 And add liquidity simultaneously", async function () {
      const optimalSwapUser1 = await optimalSwapContract.connect(user1);

      const token0Address = token0Contract.target;
      const token1Address = token1Contract.target;
      const amount = ethers.parseEther(desiredSwapAmount);
      const slippage = 50;
      const deadline = Date.now() + 60 * 1000 * 10;
      const [r0B, r1B] = await pairContract.getReserves();
      const t0BBal = ethers.formatEther(
        await token0Contract.balanceOf(user1.address)
      );
      const t1BBal = ethers.formatEther(
        await token1Contract.balanceOf(user1.address)
      );

      console.log(`User1's tx : call swapAndAddLiquidity`);
      const amountOut = await routerContract.getAmountOut(
        new b(amount).div(2).integerValue().toFixed(),
        r1B,
        r0B
      );
      const swapAmountOutMin = new b(amountOut)
        .times(10000 - slippage)
        .div(10000)
        .integerValue()
        .toFixed();

      const tx = await optimalSwapUser1.swapAndAddLiquidity({
        fromToken: token1Address,
        toToken: token0Address,
        amountInputDesired: amount,
        swapAmountOutMin,
        slippage,
        to: user1.address,
        deadline,
      });
      await tx.wait();
      const lpUser1Balance = await pairContract.balanceOf(user1.address);

      const [r0A, r1A] = await pairContract.getReserves();
      const t0ABal = ethers.formatEther(
        await token0Contract.balanceOf(user1.address)
      );
      const t1ABal = ethers.formatEther(
        await token1Contract.balanceOf(user1.address)
      );

      console.log(`User1's token0 balance: ${t0BBal} => ${t0ABal}`);
      console.log(`User1's token1 balance: ${t1BBal} => ${t1ABal}`);
      console.log(
        `Reserve0 : ${ethers.formatEther(r0B)} => ${ethers.formatEther(
          r0A
        )} (diff : ${new b(r0A).minus(r0B).abs().div(1e18).toString()})`
      );
      console.log(
        `Reserve1 : ${ethers.formatEther(r1B)} => ${ethers.formatEther(
          r1A
        )} (diff : ${new b(r1A).minus(r1B).abs().div(1e18).toString()})`
      );
      expect(lpUser1Balance).not.to.equal(0);
    });
  });
  describe("Burn remaining Tokens", function () {
    it("Should burn remaining tokens", async function () {
      const token0User1 = await token0Contract.connect(user1);
      const token1User1 = await token1Contract.connect(user1);
      const token0Bal = await token0User1.balanceOf(user1.address);
      const token1Bal = await token1User1.balanceOf(user1.address);
      if (token0Bal > 0n) {
        await token0User1.transfer(ethers.ZeroAddress, token0Bal);
      }
      if (token1Bal > 0n) {
        await token1User1.transfer(ethers.ZeroAddress, token1Bal);
      }
      const token0BalA = await token0User1.balanceOf(user1.address);
      const token1BalA = await token1User1.balanceOf(user1.address);
      expect(token0BalA).to.equal(0);
      expect(token1BalA).to.equal(0);
    });
  });
  describe("💫Swap And Add Liquidity From Native Token", function () {
    it("Create Pair Token0-WETH", async function () {
      await factoryContract.createPair(
        token0Contract.target,
        WETHContract.target
      );
      const pairAddress = await factoryContract.getPair(
        token0Contract.target,
        WETHContract.target
      );
      const pairF = await ethers.getContractFactory("UniswapV2Pair");
      pairContract = await pairF.attach(pairAddress);
      expect(pairContract.target).not.to.equal(ethers.ZeroAddress);
    });
    it(`Add Liquidity : Token0(${initReserveETH}) WETH(${initReserve0_2})`, async function () {
      const routerDeployer = await routerContract.connect(deployer);
      const ethAmount = ethers.parseEther(initReserveETH);
      const token0Amount = ethers.parseEther(initReserve0_2);

      const deployerToken0 = await token0Contract.connect(deployer);
      await deployerToken0.approve(routerContract.target, token0Amount);
      await deployerToken0.faucet(token0Amount);

      await routerDeployer.addLiquidityETH(
        token0Contract.target,
        token0Amount,
        token0Amount,
        ethAmount,
        deployer.address,
        Date.now() + 60 * 1000 * 10,
        { value: token0Amount }
      );

      const [reserves0, reserves1] = await pairContract.getReserves();
      expect(reserves0).to.equal(
        (await pairContract.token0) == WETHContract.target
          ? ethAmount
          : token0Amount
      );
      expect(reserves1).to.equal(
        (await pairContract.token1) == WETHContract.target
          ? ethAmount
          : token0Amount
      );
    });

    it("Swap Native to Token And Add Liquidity", async function () {
      const optimalSwapUser1 = await optimalSwapContract.connect(user1);
      const usersNativeBalance = await ethers.provider.getBalance(
        user1.address
      );
      const usersToken0Balance = await token0Contract.balanceOf(user1.address);

      const token0Address = token0Contract.target;

      const pairAddress = await factoryContract.getPair(
        token0Contract.target,
        WETHContract.target
      );
      const pairF = await ethers.getContractFactory("UniswapV2Pair");
      pairContract = await pairF.attach(pairAddress);

      const slippage = 50;

      const [r0B, r1B] = await pairContract.getReserves();
      const amountOut = await routerContract.getAmountOut(
        new b(desiredSwapAmountETH).div(2).integerValue().toFixed(),
        WETHContract.target < token0Address ? r0B : r1B,
        WETHContract.target < token0Address ? r1B : r0B
      );
      const swapAmountOutMin = new b(amountOut)
        .times(10000 - slippage)
        .div(10000)
        .integerValue()
        .toFixed();

      const tx = await optimalSwapUser1.swapAndAddLiquidityFromETH(
        {
          toToken: token0Address,
          swapAmountOutMin,
          slippage,
          to: user1.address,
          deadline: Date.now() + 60 * 1000 * 10,
        },
        { value: ethers.parseEther(desiredSwapAmountETH) }
      );
      await tx.wait();

      const usersNativeBalanceA = await ethers.provider.getBalance(
        user1.address
      );
      const usersToken0BalanceA = await token0Contract.balanceOf(user1.address);
      console.log(
        `User's native balance: ${ethers.formatEther(
          usersNativeBalance
        )} => ${ethers.formatEther(usersNativeBalanceA)}`
      );
      console.log(
        `User's token0 balance: ${ethers.formatEther(
          usersToken0Balance
        )} => ${ethers.formatEther(usersToken0BalanceA)}`
      );
      expect(await pairContract.balanceOf(user1.address)).not.to.equal(0);
    });
  });

  describe("💫Swap And Add Liquidity to Native Token", function () {
    it(`Burn remaining token0`, async function () {
      const token0User1 = await token0Contract.connect(user1);
      const token0Bal = await token0User1.balanceOf(user1.address);
      if (token0Bal > 0n) {
        await token0User1.transfer(ethers.ZeroAddress, token0Bal);
      }
      const token0BalA = await token0User1.balanceOf(user1.address);
      expect(token0BalA).to.equal(0);
    });
    it(`Faucet token0`, async function () {
      const token0User1 = await token0Contract.connect(user1);
      await token0User1.faucet(ethers.parseEther(desiredSwapAmountETH));
      const token0User1Balance = await token0User1.balanceOf(user1.address);
      expect(token0User1Balance).to.equal(
        ethers.parseEther(desiredSwapAmountETH)
      );
    });
    it("Check if WETH working", async function () {
      const wethUser1 = await WETHContract.connect(user1);
      const wethBal = await wethUser1.balanceOf(user1.address);
      expect(wethBal).to.equal(0);
      await wethUser1.deposit({ value: ethers.parseEther("1") });
      expect(await wethUser1.balanceOf(user1.address)).to.equal(
        ethers.parseEther("1")
      );
      await wethUser1.withdraw(ethers.parseEther("1"));
      expect(await wethUser1.balanceOf(user1.address)).to.equal(0);
    });
    it("Swap Token to Native And Add Liquidity", async function () {
      const optimalSwapUser1 = await optimalSwapContract.connect(user1);
      const usersNativeBalance = await ethers.provider.getBalance(
        user1.address
      );
      const usersToken0Balance = await token0Contract.balanceOf(user1.address);

      const token0Address = token0Contract.target;
      await token0Contract
        .connect(user1)
        .approve(
          optimalSwapContract.target,
          ethers.parseEther(desiredSwapAmountETH)
        );

      const pairAddress = await factoryContract.getPair(
        token0Contract.target,
        WETHContract.target
      );
      const pairF = await ethers.getContractFactory("UniswapV2Pair");
      pairContract = await pairF.attach(pairAddress);
      const usersNativeBalanceA = await ethers.provider.getBalance(
        user1.address
      );

      const [r0B, r1B] = await pairContract.getReserves();
      const slippage = 50;

      const amountOut = await routerContract.getAmountOut(
        new b(desiredSwapAmountETH).div(2).integerValue().toFixed(),
        WETHContract.target < token0Address ? r1B : r0B,
        WETHContract.target < token0Address ? r0B : r1B
      );
      const swapAmountOutMin = new b(amountOut)
        .times(10000 - slippage)
        .div(10000)
        .integerValue()
        .toFixed();
      const tx = await optimalSwapUser1.swapAndAddLiquidityToETH({
        fromToken: token0Address,
        amountInputDesired: ethers.parseEther(desiredSwapAmountETH),
        swapAmountOutMin,
        slippage,
        to: user1.address,
        deadline: Date.now() + 60 * 1000 * 10,
      });
      await tx.wait();

      const usersToken0BalanceA = await token0Contract.balanceOf(user1.address);
      console.log(
        `User's native balance: ${ethers.formatEther(
          usersNativeBalance
        )} => ${ethers.formatEther(usersNativeBalanceA)}`
      );
      console.log(
        `User's token0 balance: ${ethers.formatEther(
          usersToken0Balance
        )} => ${ethers.formatEther(usersToken0BalanceA)}`
      );
      expect(await pairContract.balanceOf(user1.address)).not.to.equal(0);
    });
  });
});
