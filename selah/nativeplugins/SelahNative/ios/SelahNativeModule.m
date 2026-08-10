#import "SelahNativeModule.h"
#import "DCUniDefine.h"
#import <UIKit/UIKit.h>

/// App Group — must match entitlements & SelahNativeConstants.swift
static NSString * const kSelahAppGroupId = @"group.com.selah.app";
static NSString * const kSelahPayloadKey = @"widget_payload_json";
static NSString * const kSelahQuoteKey = @"quote_content";
static NSString * const kSelahAccentKey = @"accent";
static NSString * const kSelahUpdatedKey = @"updated_at";

@implementation SelahNativeModule

UNI_EXPORT_METHOD(@selector(writeWidgetPayload:callback:))
UNI_EXPORT_METHOD(@selector(setAppIcon:callback:))
UNI_EXPORT_METHOD(@selector(reloadWidgets:callback:))
UNI_EXPORT_METHOD_SYNC(@selector(getCachedPayload:))

- (void)selah_reloadWidgetTimelines {
    // WidgetKit is Swift-only; invoke via runtime to avoid hard-link issues in ObjC plugins.
    Class centerClass = NSClassFromString(@"WidgetCenter");
    if (!centerClass) return;
    SEL sharedSel = NSSelectorFromString(@"shared");
    if (![centerClass respondsToSelector:sharedSel]) return;
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    id center = [centerClass performSelector:sharedSel];
    SEL reloadSel = NSSelectorFromString(@"reloadAllTimelines");
    if ([center respondsToSelector:reloadSel]) {
        [center performSelector:reloadSel];
    }
#pragma clang diagnostic pop
}

- (void)writeWidgetPayload:(NSDictionary *)options callback:(UniModuleKeepAliveCallback)callback {
    NSString *json = options[@"json"];
    if (![json isKindOfClass:[NSString class]] || json.length == 0) {
        if (callback) callback(@{@"ok": @NO, @"error": @"missing_json"}, NO);
        return;
    }
    NSUserDefaults *suite = [[NSUserDefaults alloc] initWithSuiteName:kSelahAppGroupId];
    if (!suite) {
        if (callback) callback(@{@"ok": @NO, @"error": @"app_group_unavailable"}, NO);
        return;
    }
    [suite setObject:json forKey:kSelahPayloadKey];

    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    if (data) {
        id obj = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        if ([obj isKindOfClass:[NSDictionary class]]) {
            NSDictionary *dict = (NSDictionary *)obj;
            NSDictionary *quote = [dict[@"quote"] isKindOfClass:[NSDictionary class]] ? dict[@"quote"] : nil;
            NSString *content = [quote[@"content"] isKindOfClass:[NSString class]] ? quote[@"content"] : @"Selah";
            NSString *accent = [dict[@"accent"] isKindOfClass:[NSString class]] ? dict[@"accent"] : @"#B6BADD";
            NSString *updated = [dict[@"updated_at"] isKindOfClass:[NSString class]]
                ? dict[@"updated_at"]
                : [[NSISO8601DateFormatter new] stringFromDate:[NSDate date]];
            [suite setObject:content forKey:kSelahQuoteKey];
            [suite setObject:accent forKey:kSelahAccentKey];
            [suite setObject:updated forKey:kSelahUpdatedKey];
        }
    }
    [suite synchronize];
    [self selah_reloadWidgetTimelines];
    if (callback) callback(@{@"ok": @YES}, NO);
}

- (void)setAppIcon:(NSDictionary *)options callback:(UniModuleKeepAliveCallback)callback {
    NSString *key = options[@"icon_key"];
    if (![key isKindOfClass:[NSString class]]) key = @"default";
    NSString *name = ([key isEqualToString:@"default"] || key.length == 0) ? nil : key;

    dispatch_async(dispatch_get_main_queue(), ^{
        UIApplication *app = [UIApplication sharedApplication];
        if (![app supportsAlternateIcons]) {
            if (callback) callback(@{@"ok": @NO, @"error": @"alternate_icons_unsupported"}, NO);
            return;
        }
        [app setAlternateIconName:name completionHandler:^(NSError * _Nullable error) {
            if (error) {
                if (callback) callback(@{@"ok": @NO, @"error": error.localizedDescription ?: @"icon_failed"}, NO);
            } else {
                if (callback) callback(@{@"ok": @YES, @"icon_key": key}, NO);
            }
        }];
    });
}

- (void)reloadWidgets:(NSDictionary *)options callback:(UniModuleKeepAliveCallback)callback {
    [self selah_reloadWidgetTimelines];
    if (callback) callback(@{@"ok": @YES}, NO);
}

- (NSString *)getCachedPayload:(NSDictionary *)options {
    NSUserDefaults *suite = [[NSUserDefaults alloc] initWithSuiteName:kSelahAppGroupId];
    NSString *json = [suite stringForKey:kSelahPayloadKey];
    return json ?: @"";
}

@end
