package com.javi06.pos1

import android.os.Build
import android.util.Log

object PrinterCapabilityDetector {
    private const val TAG = "PrinterCapabilityDetector"

    fun detectPaperSize(): String {
        val model = Build.MODEL.uppercase()
        Log.d(TAG, "Detecting Sunmi printer size by device model: $model")
        return when {
            model.contains("D3") -> "80mm"
            model.contains("T2") && !model.contains("MINI") -> "80mm"
            model.contains("T2LITE") || model.contains("T2 LITE") -> "80mm"
            model.contains("V2") -> "58mm"
            model.contains("T2MINI") -> "58mm"
            model.contains("D2") -> "58mm"
            else -> "58mm" // Safe default fallback
        }
    }
}
