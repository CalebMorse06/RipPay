# Keep the HostApduService class name — the system looks it up by the name
# declared in AndroidManifest.xml and would silently fail to bind if obfuscated.
-keep class com.coldtap.hce.ColdTapApduService { *; }
