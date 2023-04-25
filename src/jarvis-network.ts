import {
  Minted as MintedEvent,
  Redeemed as RedeemedEvent
} from "../generated/SynthereumPool/SynthereumPool"
import {
  PositionCreated as PositionCreatedEvent,
  Redeem as RedeemEvent,
  Repay as RepayEvent,
} from "../generated/CreditLineEurBtc/CreditLine"
import {
  GlobalFees,
  PoolAccumulatedFees,
  CreditLineAccumulatedFees
} from "../generated/schema"
import { SynthereumPriceFeed } from "./synthereum-price-feed"
import { BigInt, Bytes, typeConversion, Address } from "@graphprotocol/graph-ts";


const usdcDecimalConverter = BigInt.fromI64(1000000000000);
const weiScaling = BigInt.fromI64(1000000000000000000);
const globalFeesId = 'JarvisGlobalFees';
const synthereumPriceFeedAddress = Address.fromString("0xd8D32702c398528904e1367999f1563Eb4DF731a")
const usdcCollateralContracts = [typeConversion.stringToH160("0xb145fB1ef8E3B0202af4012F6bebc00e6882a10D"), typeConversion.stringToH160("0xA3d49d2Fc84497F4eb5A1A3EA54380eceF8a7eF7")]
const opCollateralContracts = [typeConversion.stringToH160("0x316E8d1C8aC44ce235c5e7c4a9c1d476F4B83456")]
const wethCollateralContracts = [typeConversion.stringToH160("0x3d8DA6b03DB2B50dA1850c1D237b73092f7c977d")]
const wbtcCollateralContracts = [typeConversion.stringToH160("0xE53dB5B21262F142F0d78Bb31B85c4b1Ee9faAbD")]
const wstethCollateralContracts = [typeConversion.stringToH160("0x20981e320761BEB3b49F2fdEBb075b4d917bbAAc")]

export function handleMinted(event: MintedEvent): void {
  let globalFeesEntity = GlobalFees.load(globalFeesId)
  let finalAmount = computeValue(event.address, event.params.mintvalues.feeAmount)
  poolFees(event.address, event.params.mintvalues.feeAmount, finalAmount)
  if (globalFeesEntity == null) {
    let globalFeesEntity = new GlobalFees(globalFeesId)
    globalFeesEntity.totalCreditLineFeesUsd = new BigInt(0)
    globalFeesEntity.totalPoolFeesUsd = finalAmount
    globalFeesEntity.totalJarvisFeesUsd = finalAmount
    globalFeesEntity.save()
  }
  else {
    globalFeesEntity.totalPoolFeesUsd = globalFeesEntity.totalPoolFeesUsd.plus(finalAmount)
    globalFeesEntity.totalJarvisFeesUsd = globalFeesEntity.totalJarvisFeesUsd.plus(finalAmount)
    globalFeesEntity.save()
  }
}


export function handleRedeemed(event: RedeemedEvent): void {
  let globalFeesEntity = GlobalFees.load(globalFeesId)
  let finalAmount = computeValue(event.address, event.params.redeemvalues.feeAmount)
  poolFees(event.address, event.params.redeemvalues.feeAmount, finalAmount)
  if (globalFeesEntity == null) {
    let globalFeesEntity = new GlobalFees(globalFeesId)
    globalFeesEntity.totalCreditLineFeesUsd = new BigInt(0)
    globalFeesEntity.totalPoolFeesUsd = finalAmount
    globalFeesEntity.totalJarvisFeesUsd = finalAmount
    globalFeesEntity.save()
  } else {
    globalFeesEntity.totalPoolFeesUsd = globalFeesEntity.totalPoolFeesUsd.plus(finalAmount)
    globalFeesEntity.totalJarvisFeesUsd = globalFeesEntity.totalJarvisFeesUsd.plus(finalAmount)
    globalFeesEntity.save()
  }
}

export function poolFees(poolAddress: Bytes, feeAmountNative: BigInt, feeAmountUsd: BigInt): void {
  let poolFeesEntity = PoolAccumulatedFees.load(poolAddress)
  if (poolFeesEntity == null) {
    let poolFeesEntity = new PoolAccumulatedFees(poolAddress)
    poolFeesEntity.totalPoolFeesNative = feeAmountNative
    poolFeesEntity.totalPoolFeesUsd = feeAmountUsd
    poolFeesEntity.save()
  }
  else {
    poolFeesEntity.totalPoolFeesNative = poolFeesEntity.totalPoolFeesNative.plus(feeAmountNative)
    poolFeesEntity.totalPoolFeesUsd = poolFeesEntity.totalPoolFeesUsd.plus(feeAmountUsd)
    poolFeesEntity.save()
  }
}

export function handlePositionCreated(event: PositionCreatedEvent): void {
  let globalFeesEntity = GlobalFees.load(globalFeesId)
  let finalAmount = computeValue(event.address, event.params.feeAmount)
  creditLineFees(event.address, event.params.feeAmount, finalAmount)
  if (globalFeesEntity == null) {
    let globalFeesEntity = new GlobalFees(globalFeesId)
    globalFeesEntity.totalPoolFeesUsd = new BigInt(0)
    globalFeesEntity.totalCreditLineFeesUsd = finalAmount
    globalFeesEntity.totalJarvisFeesUsd = finalAmount
    globalFeesEntity.save()
  } else {
    globalFeesEntity.totalCreditLineFeesUsd = globalFeesEntity.totalCreditLineFeesUsd.plus(finalAmount)
    globalFeesEntity.totalJarvisFeesUsd = globalFeesEntity.totalJarvisFeesUsd.plus(finalAmount)
    globalFeesEntity.save()
  }
}

export function creditLineFees(creditLineAddress: Bytes, feeAmountNative: BigInt, feeAmountUsd: BigInt): void {
  let creditLineFeesEntity = CreditLineAccumulatedFees.load(creditLineAddress)
  if (creditLineFeesEntity == null) {
    let creditLineFeesEntity = new CreditLineAccumulatedFees(creditLineAddress)
    creditLineFeesEntity.totalCreditLineFeesNative = feeAmountNative
    creditLineFeesEntity.totalCreditLineFeesUsd = feeAmountUsd
    creditLineFeesEntity.save()
  }
  else {
    creditLineFeesEntity.totalCreditLineFeesNative = creditLineFeesEntity.totalCreditLineFeesNative.plus(feeAmountNative)
    creditLineFeesEntity.totalCreditLineFeesUsd = creditLineFeesEntity.totalCreditLineFeesUsd.plus(feeAmountUsd)

    creditLineFeesEntity.save()
  }
}

export function computeValue(contractAddress: Bytes, value: BigInt): BigInt {
  if (usdcCollateralContracts.includes(contractAddress)) {
    let tempValue = value.times(usdcDecimalConverter)
    return tempValue
  } else if (opCollateralContracts.includes(contractAddress)) {
    let priceFeed = SynthereumPriceFeed.bind(synthereumPriceFeedAddress)
    let identifier = Bytes.fromHexString("0x5553444f50")
    let currentPrice = weiScaling.times(weiScaling).div(priceFeed.getLatestPrice(identifier))
    let tempValue = value.times(currentPrice).div(weiScaling)
    return tempValue
  } else if (wethCollateralContracts.includes(contractAddress)) {
    let priceFeed = SynthereumPriceFeed.bind(synthereumPriceFeedAddress)
    let identifier = Bytes.fromHexString("0x555344455448")
    let currentPrice = weiScaling.times(weiScaling).div(priceFeed.getLatestPrice(identifier))
    let tempValue = value.times(currentPrice).div(weiScaling)
    return tempValue
  } else if (wbtcCollateralContracts.includes(contractAddress)) {
    let priceFeed = SynthereumPriceFeed.bind(synthereumPriceFeedAddress)
    let identifier = Bytes.fromHexString("0x555344425443")
    let currentPrice = weiScaling.times(weiScaling).div(priceFeed.getLatestPrice(identifier))
    let tempValue = value.times(currentPrice).div(weiScaling)
    return tempValue
  } else if (wstethCollateralContracts.includes(contractAddress)) {
    let priceFeed = SynthereumPriceFeed.bind(synthereumPriceFeedAddress)
    let identifier = Bytes.fromHexString("0x575354455448555344")
    let currentPrice = priceFeed.getLatestPrice(identifier)
    let tempValue = value.times(currentPrice).div(weiScaling)
    return tempValue
  } else {
    return value
  }
}

