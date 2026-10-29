import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { getOrCreateDeviceId, getRegisterCountry } from "@/utils/device.js";
import { getCurrentLanguage } from "@/utils/storageKeys.js";
import { enqueueBatch } from "@/utils/analyticsBatch.js";

const firebaseConfig = {
	apiKey: "AIzaSyCgggz67DalIHIqOOg9QkDRgu5fyAIqgAY",
	authDomain: "selah-9158a.firebaseapp.com",
	projectId: "selah-9158a",
	storageBucket: "selah-9158a.firebasestorage.app",
	messagingSenderId: "37682390413",
	appId: "1:37682390413:web:a0117dcb4dce5aed88c9c4",
	measurementId: "G-4M70D23S7S"
};

/**
 * Web Analytics 依赖 window.dataLayer / gtag。
 * App 端 JS 运行时没有 window，模块顶层调用 getAnalytics 会直接白屏。
 * 只在浏览器环境按需初始化；App 埋点走 utils/analytics.js 的 plus.firebase。
 */
let app = null;
let analytics = null;
try {
	app = initializeApp(firebaseConfig);
} catch (e) {
	console.warn("firebase init fail", e);
}

function canUseWebAnalytics() {
	return typeof window !== "undefined" && typeof document !== "undefined";
}

export async function getWebAnalytics() {
	if (!app || !canUseWebAnalytics()) return null;
	if (analytics) return analytics;
	try {
		const ok = await isSupported();
		if (!ok) return null;
		analytics = getAnalytics(app);
		return analytics;
	} catch (e) {
		console.warn("firebase analytics unavailable", e);
		return null;
	}
}

const GA_CID_KEY = "selah_ga_cid";
const GA_SID_KEY = "selah_ga_sid";
const GA_SCT_KEY = "selah_ga_sct";
const GA_LAST_KEY = "selah_ga_last";
const GA_SESSION_MS = 30 * 60 * 1000;

function storageGet(key) {
	try {
		return uni.getStorageSync(key);
	} catch (e) {
		return "";
	}
}

function storageSet(key, value) {
	try {
		uni.setStorageSync(key, value);
	} catch (e) {}
}

function gaClientId() {
	let id = String(storageGet(GA_CID_KEY) || "");
	if (!/^\d+\.\d+$/.test(id)) {
		id = `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;
		storageSet(GA_CID_KEY, id);
	}
	return id;
}

function gaSession() {
	const now = Date.now();
	const last = Number(storageGet(GA_LAST_KEY) || 0);
	let sid = Number(storageGet(GA_SID_KEY) || 0);
	let sct = Number(storageGet(GA_SCT_KEY) || 0);
	let fresh = false;
	if (!sid || now - last > GA_SESSION_MS) {
		sid = Math.floor(now / 1000);
		sct += 1;
		fresh = true;
		storageSet(GA_SID_KEY, sid);
		storageSet(GA_SCT_KEY, sct);
	}
	storageSet(GA_LAST_KEY, now);
	return { sid, sct: sct || 1, fresh };
}

/**
 * App 端没有 window，Web SDK 的 logEvent 发不出去。
 * 用同一条 Web 数据流 measurementId，直接打 GA4 collect。
 */
function sendAppGa4Event(eventName, params = {}) {
	const measurementId = firebaseConfig.measurementId;
	if (!measurementId) return;
	const session = gaSession();
	let lang = "en";
	try {
		lang = String(uni.getSystemInfoSync().language || "en").replace(/_/g, "-").toLowerCase();
	} catch (e) {}
	const query = [
		"v=2",
		`tid=${encodeURIComponent(measurementId)}`,
		`cid=${encodeURIComponent(gaClientId())}`,
		`ul=${encodeURIComponent(lang)}`,
		"_s=1",
		`sid=${session.sid}`,
		`sct=${session.sct}`,
		"seg=1",
		"_et=1",
		`_p=${Math.floor(Math.random() * 1e9)}`,
		`dl=${encodeURIComponent("https://selah.app/welcome")}`,
		`dt=${encodeURIComponent("welcome")}`,
		`en=${encodeURIComponent(eventName)}`,
	];
	if (session.fresh) query.push("_ss=1");
	Object.keys(params).forEach((key) => {
		const value = params[key];
		if (value == null || value === "") return;
		const prefix = typeof value === "number" ? "epn" : "ep";
		query.push(`${prefix}.${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
	});
	const url = `https://www.google-analytics.com/g/collect?${query.join("&")}`;
	uni.request({
		url,
		method: "POST",
		header: {
			"Content-Type": "text/plain;charset=UTF-8",
			"User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
		},
		success(res) {
			console.log("[ga4] android", eventName, res.statusCode);
		},
		fail(err) {
			console.warn("[ga4] android fail", eventName, err);
		},
	});
}

/**
 * 每条事件都带的公共参数。deviceid 取值 android / ios。
 * uuid 优先用户 id，未登录时用本机设备 UUID。
 */
function firebaseCommonParams() {
	let info = {};
	try {
		info = uni.getSystemInfoSync() || {};
	} catch (e) {}
	let user = {};
	try {
		user = uni.getStorageSync("userInfo") || {};
	} catch (e) {}
	const rawPlat = String(info.platform || info.osName || "").toLowerCase();
	let deviceid = "android";
	if (rawPlat === "ios" || rawPlat.includes("ios")) deviceid = "ios";
	else if (rawPlat === "android" || rawPlat.includes("android")) deviceid = "android";
	else {
		// #ifdef APP-PLUS
		try {
			const name = String((plus.os && plus.os.name) || "").toLowerCase();
			deviceid = name === "ios" ? "ios" : "android";
		} catch (e) {}
		// #endif
	}
	const userId = String(user.user_id || user.id || user.uuid || "").trim();
	let uuid = userId;
	if (!uuid) {
		try {
			uuid = String(getOrCreateDeviceId() || "");
		} catch (e) {
			uuid = "";
		}
	}
	let appVersion = String(info.appVersion || info.appWgtVersion || info.hostVersion || "");
	// #ifdef APP-PLUS
	if (!appVersion) {
		try {
			appVersion = String((plus.runtime && plus.runtime.version) || "");
		} catch (e) {}
	}
	// #endif
	let apiLevel = Number(info.osAndroidAPILevel);
	if (!Number.isFinite(apiLevel)) {
		const matched = String(info.osVersion || info.system || "").match(/\d+/);
		apiLevel = matched ? Number(matched[0]) : 0;
	}
	const country = String(user.register_country || getRegisterCountry() || "").toUpperCase();
	return {
		uuid,
		deviceid,
		app_version: appVersion,
		device_model: String(info.deviceModel || info.model || ""),
		os_version: String(info.osVersion || info.system || ""),
		api_level: apiLevel,
		country,
		app_language: String(getCurrentLanguage() || "en"),
		device_language: String(info.language || info.osLanguage || ""),
		timestamp: Date.now(),
	};
}

/** 安卓离线包原生插件。未编进基座时返回 false。 */
export function logNativeFirebase(eventName, params = {}) {
	try {
		if (typeof uni === "undefined" || typeof uni.requireNativePlugin !== "function") return false;
		const mod = uni.requireNativePlugin("Selah-Firebase");
		if (!mod || typeof mod.logEvent !== "function") return false;
		mod.logEvent({
			name: eventName,
			params: params || {},
		});
		console.log("[firebase] native", eventName);
		return true;
	} catch (e) {
		console.warn("[firebase] native fail", e);
		return false;
	}
}

/**
 * 打一条 Firebase 事件。H5 走 Web SDK；App 走原生插件，没有插件时走 GA4 collect。
 * 公共参数自动合并；调用方传入的字段覆盖同名公共参数。
 */
export function logFirebaseEvent(eventName, params = {}) {
	const payload = { ...firebaseCommonParams(), ...(params || {}) };
	try { enqueueBatch(eventName, payload) } catch (e) {}
	// #ifdef APP-PLUS
	try {
		if (!logNativeFirebase(eventName, payload)) {
			console.warn("[firebase] Selah-Firebase 不在当前基座，改走 GA4 collect");
			sendAppGa4Event(eventName, payload);
		}
	} catch (e) {
		console.warn("ga4 app fail", e);
	}
	return;
	// #endif

	getWebAnalytics()
		.then((instance) => {
			if (!instance) return;
			logEvent(instance, eventName, payload);
		})
		.catch((e) => {
			console.warn("firebase logEvent fail", e);
		});
}

export { app, analytics };
