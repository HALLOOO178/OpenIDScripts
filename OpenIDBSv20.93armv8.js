// || OpenID ||
// This script installs an alternative SupercellID client within your game
// This script is meant to run in Brawl Stars v20.93 on arm64

/* Disclaimers:
- This isn't owned, endorsed or affiliated to Supercell AT ALL
- Some features may not be available depending on the game or version
- (Official) OpenID servers don't store any data about you or your accounts, that data is all stored within the private server's database
- You may change the "serverUrl" value in the config to edit the server the client will connect to
- The Candy Team does NOT own Null's Connect, we are not responsible for any accounts that got lost due to a Null's Connect server malfunction
*/

// By https://dsc.gg/candybrawl

const OpenIDConfig = {
    serverUrl: "https://openscid.netlify.app/",
    useNullsConnect: true,
    scidGameType: "laser",
    versionSuffix: "OpenID",
    useProd: false,
    env: "dev"
};

var globalWebivew = [];

const base = Process.getModuleByName('libg.so').base;

const malloc = new NativeFunction(Process.getModuleByName('libc.so').getExportByName('malloc'), 'pointer', ['uint']);

const SCIDConfigGetString = base.add(0x149F30);
const SCIDConfigGetBool = base.add(0xC9FA4);
const wvscidManagerOpenWindow = base.add(0x112EBC);
const applicationOpenUrl = base.add(0x560FA4);
const scidWebviewShouldOpenUrl = base.add(0x13EAD4);

const stringString = new NativeFunction(base.add(0x4DA9C8), "pointer", ["pointer", "pointer"]);
const scidWebviewGoTo = new NativeFunction(base.add(0x453C50), "pointer", ["pointer", "pointer", "pointer"]);

const TitanString = {
    ptr(str) {
        return Memory.allocUtf8String(str);
    },
    ctor(str) {
        const mem = malloc(128);
        stringString(mem, TitanString.ptr(str));
        return mem;
    },
    read(stringPtr) {
        var len = stringPtr.add(4).readU32();
        if (len >= 8) {
            return stringPtr.add(Process.pointerSize).readPointer().readUtf8String(len);
        }
        return stringPtr.add(Process.pointerSize).readUtf8String();
    }
};

const OpenID = {
    getUrl() {
        return OpenIDConfig.useNullsConnect ? "https://connect.nulls.gg" : OpenIDConfig.serverUrl;
    },
    intercept() {
        OpenID.setSCIDConfigString("Url", OpenID.getUrl());
        OpenID.setSCIDConfigBool("UseProd", OpenIDConfig.useProd);
        OpenID.setSCIDConfigBool("UseNative", false);
        OpenID.setSCIDConfigString("Environment", OpenIDConfig.env);
        OpenID.setSCIDConfigString("VersionSuffix", OpenIDConfig.versionSuffix);
        OpenID.setSCIDConfigString("Game", OpenIDConfig.scidGameType);
        OpenID.specialHooks();
    },
    setSCIDConfigString(name, value) {
        Interceptor.attach(SCIDConfigGetString, {
            onEnter(args) {
                this.val = TitanString.read(args[1]);
            },
            onLeave(retval) {
                if (this.val == name) {
                    retval.replace(TitanString.ctor(value));
                }
            }
        });
    },
    setSCIDConfigBool(name, value) {
        Interceptor.attach(SCIDConfigGetBool, {
            onEnter(args) {
                this.val = TitanString.read(args[1]);
            },
            onLeave(retval) {
                console.log("SCIDConfig::getBool name: " + this.val + " val: " + (retval.toInt32() == 1));
                if (this.val == name) {
                    retval.replace(ptr(Number(value)));
                }
            }
        });
    },
    specialHooks() {
        Interceptor.attach(wvscidManagerOpenWindow, {
            onEnter(args) {
                this.a2 = args[1];
                this.v5 = args[0].add(16).readPointer().add(112).readPointer();
            },
            onLeave(retval) {
                globalWebivew = [this.v5, this.a2];
                scidWebviewGoTo(this.v5, TitanString.ctor(OpenID.getUrl()), this.a2);
            }
        });
        Interceptor.replace(applicationOpenUrl, new NativeCallback(function(a1) {
            if (TitanString.read(a1).includes(OpenID.getUrl())) return a1;
            return new NativeFunction(applicationOpenUrl, "void", ["pointer"])(a1);
        }, "void", ["pointer"]));
        Interceptor.attach(scidWebviewShouldOpenUrl, {
            onEnter(args) {
                this.shouldRet1 = TitanString.read(args[1]).includes(OpenID.getUrl());
            },
            onLeave(retval) {
                if (this.shouldRet1) retval.replace(ptr(1));
            }
        });
    }
};

OpenID.intercept();