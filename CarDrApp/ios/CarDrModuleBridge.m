#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CarDrModule, RCTEventEmitter)

RCT_EXTERN_METHOD(initializeSDK:(NSString *)partnerID)
RCT_EXTERN_METHOD(scanForDevice)
RCT_EXTERN_METHOD(startScan)
RCT_EXTERN_METHOD(stopScan)

@end
