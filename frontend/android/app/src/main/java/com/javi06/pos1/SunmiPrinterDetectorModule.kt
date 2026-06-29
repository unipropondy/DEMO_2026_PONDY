package com.javi06.pos1

import com.facebook.react.bridge.*

class SunmiPrinterDetectorModule(private val reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SunmiPrinterDetector"

    @ReactMethod
    fun getPrinterPaperSize(promise: Promise) {
        try {
            val paperSize = PrinterCapabilityDetector.detectPaperSize()
            promise.resolve(paperSize)
        } catch (e: Exception) {
            promise.resolve("58mm") // Safe fallback
        }
    }
}
