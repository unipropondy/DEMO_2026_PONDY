package com.javi06.pos1

import com.facebook.react.bridge.*
import com.sunmi.printerx.PrinterSdk
import com.sunmi.printerx.api.PrintResult

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

    @ReactMethod
    fun openCashDrawer(promise: Promise) {
        try {
            PrinterSdk.getInstance().getPrinter(reactContext, object : PrinterSdk.PrinterListen {
                override fun onDefPrinter(printer: PrinterSdk.Printer?) {
                    if (printer != null) {
                        try {
                            printer.cashDrawerApi().open(object : PrintResult() {
                                override fun onResult(code: Int, message: String?) {
                                    if (code == 0) {
                                        promise.resolve(true)
                                    } else {
                                        promise.reject("DRAWER_ERROR", "Failed to open drawer: $message (code: $code)")
                                    }
                                }
                            })
                        } catch (e: Exception) {
                            promise.reject("DRAWER_EXCEPTION", "Exception opening drawer: ${e.message}", e)
                        }
                    } else {
                        promise.reject("NO_PRINTER", "No default printer found")
                    }
                }

                override fun onPrinters(printers: MutableList<PrinterSdk.Printer>?) {
                    // Optional: handle multiple printers
                }
            })
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", "Error opening cash drawer: ${e.message}", e)
        }
    }
}
