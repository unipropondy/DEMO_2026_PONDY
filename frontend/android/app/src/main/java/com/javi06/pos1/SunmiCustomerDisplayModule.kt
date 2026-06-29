package com.javi06.pos1

import android.app.Activity
import android.app.Application
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.view.Display
import com.facebook.react.bridge.*
import com.facebook.react.common.ReactConstants
import android.util.Log

class SunmiCustomerDisplayModule(private val reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext), 
    DisplayManager.DisplayListener, 
    Application.ActivityLifecycleCallbacks {

    companion object {
        private const val TAG = "SunmiCustomerDisplay"
        @Volatile
        private var presentation: CustomerDisplayPresentation? = null
    }

    private val displayManager: DisplayManager by lazy {
        reactContext.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    }
    private var lastDataJson: String? = null
    private var currentActivityRef: Activity? = null

    override fun initialize() {
        super.initialize()
        displayManager.registerDisplayListener(this, null)
        UiThreadUtil.runOnUiThread {
            val activity: Activity? = reactContext.currentActivity
            if (activity != null) {
                currentActivityRef = activity
                val app = activity.applicationContext as? android.app.Application
                app?.registerActivityLifecycleCallbacks(this)
            }
        }
    }

    override fun getName(): String = TAG

    private fun getSecondaryDisplay(): Display? {
        val displays = displayManager.displays
        for (display in displays) {
            if (display.displayId != Display.DEFAULT_DISPLAY &&
                (display.flags and Display.FLAG_PRESENTATION) != 0) {
                return display
            }
        }
        return null
    }

    private fun showPresentationInternal() {
        val display = getSecondaryDisplay()
        if (display == null) {
            Log.d(TAG, "No secondary display available to show Presentation")
            return
        }

        val activity = currentActivityRef ?: reactContext.currentActivity ?: return
        // We comment out the native Java presentation so that the React Native ExternalDisplay UI is not covered/blocked by this native view.
        /*
        if (presentation == null) {
            try {
                Log.d(TAG, "Creating new CustomerDisplayPresentation instance")
                presentation = CustomerDisplayPresentation(activity, display)
                presentation?.show()
                // Re-apply last data if available
                lastDataJson?.let {
                    presentation?.updateData(it)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error showing presentation", e)
            }
        } else {
            // Re-show if dismissed
            if (!presentation!!.isShowing) {
                try {
                    presentation?.show()
                } catch (e: Exception) {
                    Log.e(TAG, "Error re-showing presentation", e)
                }
            }
        }
        */
    }

    private fun hidePresentationInternal() {
        presentation?.let {
            try {
                it.dismiss()
            } catch (e: Exception) {
                Log.e(TAG, "Error dismissing presentation", e)
            }
            presentation = null
        }
    }

    @ReactMethod
    fun showCustomerDisplay() {
        UiThreadUtil.runOnUiThread {
            showPresentationInternal()
        }
    }

    @ReactMethod
    fun updateCustomerDisplay(dataJson: String) {
        UiThreadUtil.runOnUiThread {
            lastDataJson = dataJson
            showPresentationInternal()
            presentation?.updateData(dataJson)
        }
    }

    @ReactMethod
    fun hideCustomerDisplay() {
        UiThreadUtil.runOnUiThread {
            lastDataJson = null
            hidePresentationInternal()
        }
    }

    // --- DisplayManager.DisplayListener ---
    override fun onDisplayAdded(displayId: Int) {
        UiThreadUtil.runOnUiThread {
            val display = displayManager.getDisplay(displayId)
            if (display != null && (display.flags and Display.FLAG_PRESENTATION) != 0) {
                Log.d(TAG, "Secondary display connected: $displayId")
                showPresentationInternal()
            }
        }
    }

    override fun onDisplayRemoved(displayId: Int) {
        UiThreadUtil.runOnUiThread {
            val currentPres = presentation
            if (currentPres != null && currentPres.display.displayId == displayId) {
                Log.d(TAG, "Secondary display disconnected: $displayId")
                hidePresentationInternal()
            }
        }
    }

    override fun onDisplayChanged(displayId: Int) {}

    // --- ActivityLifecycleCallbacks ---
    override fun onActivityResumed(activity: Activity) {
        if (activity == currentActivityRef) {
            UiThreadUtil.runOnUiThread {
                showPresentationInternal()
            }
        }
    }

    override fun onActivityPaused(activity: Activity) {
        // We do NOT dismiss/hide here so it stays on screen when backgrounded
    }

    override fun onActivityStopped(activity: Activity) {}

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        if (currentActivityRef == null) {
            currentActivityRef = activity
        }
    }

    override fun onActivityStarted(activity: Activity) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {
        if (activity == currentActivityRef) {
            UiThreadUtil.runOnUiThread {
                hidePresentationInternal()
            }
            activity.application.unregisterActivityLifecycleCallbacks(this)
            currentActivityRef = null
        }
    }

    override fun invalidate() {
        super.invalidate()
        displayManager.unregisterDisplayListener(this)
        UiThreadUtil.runOnUiThread {
            val app = currentActivityRef?.applicationContext as? android.app.Application
            app?.unregisterActivityLifecycleCallbacks(this)
            hidePresentationInternal()
        }
    }
}
