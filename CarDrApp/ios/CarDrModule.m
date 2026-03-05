//
//  CarDrModule.m
//  CarDrApp
//
//  Created by Arvind Mehta on 03/03/26.
//
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CarDrModule, RCTEventEmitter)

RCT_EXTERN_METHOD(initializeSDK:(NSString *)partnerID)
RCT_EXTERN_METHOD(startScan)
RCT_EXTERN_METHOD(scanForDevice)
RCT_EXTERN_METHOD(stopScan)

@end
