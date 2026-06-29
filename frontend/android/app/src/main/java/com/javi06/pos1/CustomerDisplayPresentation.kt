package com.javi06.pos1

import android.app.Presentation
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import java.text.DecimalFormat
import java.util.concurrent.Executors

class CustomerDisplayPresentation(context: Context, display: Display) : Presentation(context, display) {

    private val TAG = "CustomerDisplayPresentation"

    // Root views
    private lateinit var mainContentLayout: LinearLayout
    private lateinit var welcomePane: LinearLayout
    private lateinit var checkoutLayout: LinearLayout

    // Header Views
    private lateinit var shopNameTv: TextView
    private lateinit var tableBadgeTv: TextView
    private lateinit var sectionTv: TextView

    // Left Pane Views (QR / Logo)
    private lateinit var qrContainer: LinearLayout
    private lateinit var qrTitleTv: TextView
    private lateinit var qrSubtitleTv: TextView
    private lateinit var qrImageView: ImageView
    private lateinit var logoContainer: LinearLayout
    private lateinit var logoImageView: ImageView
    private lateinit var logoShopNameTv: TextView

    // Right Pane Views (Cart)
    private lateinit var cartItemsContainer: LinearLayout
    private lateinit var subTotalTv: TextView
    private lateinit var discountTv: TextView
    private lateinit var discountRow: LinearLayout
    private lateinit var taxTv: TextView
    private lateinit var taxRow: LinearLayout
    private lateinit var roundOffTv: TextView
    private lateinit var roundOffRow: LinearLayout
    private lateinit var netTotalTv: TextView
    private lateinit var waiterFooter: LinearLayout
    private lateinit var waiterTextTv: TextView

    // Success Screen Views
    private lateinit var successLayout: LinearLayout
    private lateinit var successOrderIdTv: TextView
    private lateinit var successPaymentMethodTv: TextView
    private lateinit var successAmountPaidTv: TextView
    private lateinit var successChangeGivenTv: TextView
    private lateinit var successChangeRow: LinearLayout

    private val currencyFormat = DecimalFormat("#,##0.00")
    private val executor = Executors.newCachedThreadPool()
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Root View Container
        val container = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#F8FAFC")) // bgMain / Slate 50
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

        // 1. Header Banner
        val headerBanner = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.WHITE)
            setPadding(24, 16, 24, 16)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            // Add a bottom border shadow/color
            val border = GradientDrawable().apply {
                setColor(Color.WHITE)
                setStroke(2, Color.parseColor("#E2E8F0"))
            }
            background = border
        }

        shopNameTv = TextView(context).apply {
            text = "Welcome"
            textSize = 20f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A")) // Slate 900
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        headerBanner.addView(shopNameTv)

        sectionTv = TextView(context).apply {
            text = ""
            textSize = 14f
            setTextColor(Color.parseColor("#64748B")) // Slate 500
            setPadding(0, 0, 16, 0)
            visibility = View.GONE
        }
        headerBanner.addView(sectionTv)

        tableBadgeTv = TextView(context).apply {
            text = ""
            textSize = 14f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.WHITE)
            setPadding(12, 6, 12, 6)
            val bgShape = GradientDrawable().apply {
                cornerRadius = 8f
                setColor(Color.parseColor("#EF4444")) // Red 500
            }
            background = bgShape
            visibility = View.GONE
        }
        headerBanner.addView(tableBadgeTv)

        container.addView(headerBanner)

        // 2. Main Content Frame (Checkout Layout / Welcome Attract / Success Screen)
        val contentFrame = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }

        // A. Welcome Pane (Idle Screen)
        welcomePane = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#1E293B")) // Slate 800
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        val welcomeTitle = TextView(context).apply {
            text = "Welcome to Our Restaurant"
            textSize = 32f
            setTextColor(Color.WHITE)
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        val welcomeSubtitle = TextView(context).apply {
            text = "Please place your order at the cashier counter."
            textSize = 18f
            setTextColor(Color.parseColor("#94A3B8")) // Slate 400
            gravity = Gravity.CENTER
            setPadding(0, 16, 0, 0)
        }
        welcomePane.addView(welcomeTitle)
        welcomePane.addView(welcomeSubtitle)
        contentFrame.addView(welcomePane)

        // B. Active Checkout Layout (Split View)
        checkoutLayout = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            visibility = View.GONE
        }

        // Left Pane (Logo or QR payment)
        val leftPane = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#F1F5F9")) // Slate 100
            setPadding(24, 24, 24, 24)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 4.5f)
        }

        // QR Payment view
        qrContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        qrTitleTv = TextView(context).apply {
            text = "Scan to Pay"
            textSize = 18f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 12)
        }
        qrImageView = ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(250, 250).apply {
                gravity = Gravity.CENTER
            }
            adjustViewBounds = true
        }
        qrSubtitleTv = TextView(context).apply {
            text = "Scan QR code with your mobile app"
            textSize = 13f
            setTextColor(Color.parseColor("#64748B"))
            gravity = Gravity.CENTER
            setPadding(0, 12, 0, 0)
        }
        qrContainer.addView(qrTitleTv)
        qrContainer.addView(qrImageView)
        qrContainer.addView(qrSubtitleTv)
        leftPane.addView(qrContainer)

        // Logo / Branding view (Default)
        logoContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        logoImageView = ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(160, 160).apply {
                gravity = Gravity.CENTER
                bottomMargin = 16
            }
        }
        logoShopNameTv = TextView(context).apply {
            text = ""
            textSize = 24f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
            gravity = Gravity.CENTER
        }
        logoContainer.addView(logoImageView)
        logoContainer.addView(logoShopNameTv)
        leftPane.addView(logoContainer)

        checkoutLayout.addView(leftPane)

        // Right Pane (Receipt Cart & Totals)
        val rightPane = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
            setPadding(24, 24, 24, 24)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 5.5f)
        }

        // Receipt header label
        val receiptHeader = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, 8)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            val line = GradientDrawable().apply {
                setColor(Color.WHITE)
                setStroke(2, Color.parseColor("#CBD5E1")) // Slate 300
            }
            background = line
        }
        val descLabel = TextView(context).apply {
            text = "Description"
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#64748B"))
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val qtyLabel = TextView(context).apply {
            text = "Qty"
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#64748B"))
            setPadding(16, 0, 16, 0)
        }
        val totalLabel = TextView(context).apply {
            text = "Total"
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#64748B"))
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(120, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        receiptHeader.addView(descLabel)
        receiptHeader.addView(qtyLabel)
        receiptHeader.addView(totalLabel)
        rightPane.addView(receiptHeader)

        // ScrollView for Cart Items
        val cartScroll = ScrollView(context).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f).apply {
                topMargin = 8
                bottomMargin = 8
            }
        }
        cartItemsContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        cartScroll.addView(cartItemsContainer)
        rightPane.addView(cartScroll)

        // Summary details
        val summaryLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 12, 0, 0)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        val subTotalRow = createSummaryField(summaryLayout, "Sub Total")
        subTotalTv = subTotalRow.second

        val discResult = createSummaryField(summaryLayout, "Discount")
        discountRow = discResult.first
        discountTv = discResult.second

        val taxResult = createSummaryField(summaryLayout, "Tax")
        taxRow = taxResult.first
        taxTv = taxResult.second

        val roundResult = createSummaryField(summaryLayout, "RoundOff")
        roundOffRow = roundResult.first
        roundOffTv = roundResult.second

        // High contrast Net Total box
        val netTotalContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(16, 12, 16, 12)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = 12
            }
            val border = GradientDrawable().apply {
                setColor(Color.parseColor("#FFF7ED")) // orange 50
                cornerRadius = 8f
                setStroke(2, Color.parseColor("#FED7AA")) // orange 200
            }
            background = border
        }
        val netTotalLabel = TextView(context).apply {
            text = "Net Total"
            textSize = 18f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#EA580C")) // Orange 600
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        netTotalTv = TextView(context).apply {
            text = "₹0.00"
            textSize = 22f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#EA580C"))
            gravity = Gravity.END
        }
        netTotalContainer.addView(netTotalLabel)
        netTotalContainer.addView(netTotalTv)
        summaryLayout.addView(netTotalContainer)

        // Waiter Footer
        waiterFooter = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 12, 0, 0)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            visibility = View.GONE
        }
        waiterTextTv = TextView(context).apply {
            text = ""
            textSize = 12f
            setTextColor(Color.parseColor("#64748B"))
        }
        waiterFooter.addView(waiterTextTv)
        summaryLayout.addView(waiterFooter)

        rightPane.addView(summaryLayout)
        checkoutLayout.addView(rightPane)
        contentFrame.addView(checkoutLayout)

        // C. Payment Success Layout
        successLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.WHITE)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            visibility = View.GONE
        }

        val successCard = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
            val border = GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadius = 16f
                setStroke(2, Color.parseColor("#E2E8F0"))
            }
            background = border
            layoutParams = LinearLayout.LayoutParams(480, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        val successIcon = TextView(context).apply {
            text = "✓"
            textSize = 50f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#22C55E")) // Green 500
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }
        successCard.addView(successIcon)

        val successTitle = TextView(context).apply {
            text = "Payment Successful"
            textSize = 24f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
            gravity = Gravity.CENTER
        }
        successCard.addView(successTitle)

        successOrderIdTv = TextView(context).apply {
            text = "Order #"
            textSize = 15f
            setTextColor(Color.parseColor("#64748B"))
            gravity = Gravity.CENTER
            setPadding(0, 6, 0, 24)
        }
        successCard.addView(successOrderIdTv)

        // Detail rows
        successPaymentMethodTv = createSuccessDetailRow(successCard, "Settlement Mode")
        successAmountPaidTv = createSuccessDetailRow(successCard, "Amount Paid")
        
        val changeRowResult = createSuccessDetailRowWithContainer(successCard, "Change Given")
        successChangeRow = changeRowResult.first
        successChangeGivenTv = changeRowResult.second

        val successFooter = TextView(context).apply {
            text = "Thank you! Visit us again."
            textSize = 14f
            setTextColor(Color.parseColor("#94A3B8"))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 0)
        }
        successCard.addView(successFooter)
        successLayout.addView(successCard)
        contentFrame.addView(successLayout)

        container.addView(contentFrame)

        setContentView(container)
    }

    private fun createSummaryField(parent: LinearLayout, label: String): Pair<LinearLayout, TextView> {
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 4, 0, 4)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        val labelTv = TextView(context).apply {
            text = label
            textSize = 14f
            setTextColor(Color.parseColor("#64748B"))
        }
        val valueTv = TextView(context).apply {
            text = "₹0.00"
            textSize = 14f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#334155"))
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        row.addView(labelTv)
        row.addView(valueTv)
        parent.addView(row)
        return Pair(row, valueTv)
    }

    private fun createSuccessDetailRow(parent: LinearLayout, label: String): TextView {
        return createSuccessDetailRowWithContainer(parent, label).second
    }

    private fun createSuccessDetailRowWithContainer(parent: LinearLayout, label: String): Pair<LinearLayout, TextView> {
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 6, 0, 6)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        val labelTv = TextView(context).apply {
            text = label
            textSize = 15f
            setTextColor(Color.parseColor("#64748B"))
        }
        val valueTv = TextView(context).apply {
            text = ""
            textSize = 15f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        row.addView(labelTv)
        row.addView(valueTv)
        parent.addView(row)
        return Pair(row, valueTv)
    }

    private fun createDivider(): View {
        return View(context).apply {
            setBackgroundColor(Color.parseColor("#F1F5F9"))
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 2)
        }
    }

    fun updateData(jsonStr: String) {
        try {
            val data = JSONObject(jsonStr)
            val active = data.optBoolean("active", false)
            val paymentSuccess = data.optBoolean("paymentSuccess", false)
            val currencySymbol = data.optString("currencySymbol", "₹")

            // Top Header Info
            shopNameTv.text = data.optString("companyName", "Welcome")
            val section = data.optString("section", "")
            if (section.isNotEmpty()) {
                sectionTv.text = section
                sectionTv.visibility = View.VISIBLE
            } else {
                sectionTv.visibility = View.GONE
            }

            val tableNo = data.optString("tableNo", "")
            if (tableNo.isNotEmpty()) {
                tableBadgeTv.text = tableNo
                tableBadgeTv.visibility = View.VISIBLE
            } else {
                tableBadgeTv.visibility = View.GONE
            }

            if (!active) {
                // Render Idle Attract view
                welcomePane.visibility = View.VISIBLE
                checkoutLayout.visibility = View.GONE
                successLayout.visibility = View.GONE
                return
            }

            if (paymentSuccess) {
                // Render success view
                welcomePane.visibility = View.GONE
                checkoutLayout.visibility = View.GONE
                successLayout.visibility = View.VISIBLE

                successOrderIdTv.text = "Order #${data.optString("orderId", "")}"
                successPaymentMethodTv.text = data.optString("paymentMethod", "UPI/CARD")
                
                val paid = data.optDouble("paid", 0.0)
                val netTotal = data.optDouble("netTotal", 0.0)
                val finalPaid = if (paid > 0) paid else netTotal
                successAmountPaidTv.text = "$currencySymbol${currencyFormat.format(finalPaid)}"

                val change = data.optDouble("change", 0.0)
                if (change > 0) {
                    successChangeGivenTv.text = "$currencySymbol${currencyFormat.format(change)}"
                    successChangeRow.visibility = View.VISIBLE
                } else {
                    successChangeRow.visibility = View.GONE
                }
                return
            }

            // Regular Cart Update View
            welcomePane.visibility = View.GONE
            checkoutLayout.visibility = View.VISIBLE
            successLayout.visibility = View.GONE

            // Handle Left Pane (Logo vs Payment QR)
            val paymentMethod = data.optString("paymentMethod", "")
            val isUPI = paymentMethod.contains("UPI", ignoreCase = true) || 
                        paymentMethod.contains("GPAY", ignoreCase = true) || 
                        paymentMethod.contains("PHONE", ignoreCase = true) || 
                        paymentMethod.contains("PAYTM", ignoreCase = true)
            val isPayNow = paymentMethod.contains("PAYNOW", ignoreCase = true) || 
                           paymentMethod.contains("QR", ignoreCase = true)

            val upiId = data.optString("upiId", "")
            val payNowQrUrl = data.optString("payNowQrUrl", "")
            val companyLogo = data.optString("companyLogo", "")

            if (paymentMethod.isNotEmpty() && isUPI && upiId.isNotEmpty()) {
                logoContainer.visibility = View.GONE
                qrContainer.visibility = View.VISIBLE
                qrTitleTv.text = "Scan to Pay via UPI"
                qrSubtitleTv.text = "GPay, PhonePe, Paytm, BHIM"

                val upiUrl = "upi://pay?pa=$upiId&pn=${data.optString("companyName", "Shop")}&am=${data.optDouble("netTotal", 0.0)}&cu=INR"
                val apiQrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${java.net.URLEncoder.encode(upiUrl, "UTF-8")}"
                loadImageAsync(apiQrUrl, qrImageView)
            } else if (paymentMethod.isNotEmpty() && isPayNow && payNowQrUrl.isNotEmpty()) {
                logoContainer.visibility = View.GONE
                qrContainer.visibility = View.VISIBLE
                qrTitleTv.text = "Scan to Pay via PayNow"
                qrSubtitleTv.text = "Scan QR code with your mobile banking app"
                loadImageAsync(payNowQrUrl, qrImageView)
            } else {
                qrContainer.visibility = View.GONE
                logoContainer.visibility = View.VISIBLE
                logoShopNameTv.text = data.optString("companyName", "")
                if (companyLogo.isNotEmpty()) {
                    loadImageAsync(companyLogo, logoImageView)
                } else {
                    logoImageView.setImageResource(android.R.drawable.ic_menu_gallery)
                }
            }

            // Totals
            subTotalTv.text = "$currencySymbol${currencyFormat.format(data.optDouble("subTotal", 0.0))}"
            
            val orderDiscount = data.optDouble("orderDiscountAmount", 0.0)
            val itemDiscounts = data.optDouble("itemDiscounts", 0.0)
            val totalDiscounts = orderDiscount + itemDiscounts
            if (totalDiscounts > 0) {
                discountTv.text = "-$currencySymbol${currencyFormat.format(totalDiscounts)}"
                discountRow.visibility = View.VISIBLE
            } else {
                discountRow.visibility = View.GONE
            }

            val gstAmount = data.optDouble("gstAmount", 0.0)
            if (gstAmount > 0) {
                taxTv.text = "$currencySymbol${currencyFormat.format(gstAmount)}"
                taxRow.visibility = View.VISIBLE
            } else {
                taxRow.visibility = View.GONE
            }

            val roundOff = data.optDouble("roundOff", 0.0)
            if (roundOff != 0.0) {
                val prefix = if (roundOff > 0) "+" else ""
                roundOffTv.text = "$prefix$currencySymbol${currencyFormat.format(roundOff)}"
                roundOffRow.visibility = View.VISIBLE
            } else {
                roundOffRow.visibility = View.GONE
            }

            netTotalTv.text = "$currencySymbol${currencyFormat.format(data.optDouble("netTotal", 0.0))}"

            // Served by waiter
            val waiterName = data.optString("waiterName", "")
            if (waiterName.isNotEmpty()) {
                waiterTextTv.text = "Served by: $waiterName"
                waiterFooter.visibility = View.VISIBLE
            } else {
                waiterFooter.visibility = View.GONE
            }

            // Render Cart Items
            cartItemsContainer.removeAllViews()
            val itemsArray = data.optJSONArray("items")
            if (itemsArray != null) {
                for (i in 0 until itemsArray.length()) {
                    val itemObj = itemsArray.getJSONObject(i)
                    val isVoided = itemObj.optBoolean("isVoided", false)

                    val itemLayout = LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        setPadding(0, 8, 0, 8)
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                    }

                    // Description column
                    val descCol = LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                    }
                    val itemNameTv = TextView(context).apply {
                        text = itemObj.optString("name", "")
                        textSize = 14f
                        setTypeface(null, Typeface.BOLD)
                        setTextColor(if (isVoided) Color.parseColor("#94A3B8") else Color.parseColor("#334155"))
                        if (isVoided) {
                            paintFlags = paintFlags or android.graphics.Paint.STRIKE_THRU_TEXT_FLAG
                            text = "${text} (VOIDED)"
                        }
                    }
                    descCol.addView(itemNameTv)

                    // Modifiers, notes, discounts
                    val modifiers = itemObj.optJSONArray("modifiers")
                    if (modifiers != null && modifiers.length() > 0) {
                        for (m in 0 until modifiers.length()) {
                            val mod = modifiers.getJSONObject(m)
                            val modTv = TextView(context).apply {
                                text = "+ ${mod.optString("ModifierName", "")}"
                                textSize = 11f
                                setTextColor(Color.parseColor("#64748B"))
                            }
                            descCol.addView(modTv)
                        }
                    }

                    val note = itemObj.optString("note", "")
                    if (note.isNotEmpty()) {
                        val noteTv = TextView(context).apply {
                            text = "📝 $note"
                            textSize = 11f
                            setTextColor(Color.parseColor("#64748B"))
                        }
                        descCol.addView(noteTv)
                    }

                    val itemDisc = itemObj.optDouble("discountAmount", 0.0)
                    if (itemDisc > 0 && !isVoided) {
                        val discTv = TextView(context).apply {
                            text = "🏷️ Discount: -$currencySymbol${currencyFormat.format(itemDisc)}"
                            textSize = 11f
                            setTextColor(Color.parseColor("#EF4444"))
                        }
                        descCol.addView(discTv)
                    }

                    // Quantity column
                    val qtyTv = TextView(context).apply {
                        val qty = itemObj.optDouble("qty", 0.0)
                        text = String.format("%.2f", qty)
                        textSize = 14f
                        setTextColor(if (isVoided) Color.parseColor("#94A3B8") else Color.parseColor("#334155"))
                        setPadding(16, 0, 16, 0)
                    }

                    // Total column
                    val totalCol = LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        gravity = Gravity.END
                        layoutParams = LinearLayout.LayoutParams(120, ViewGroup.LayoutParams.WRAP_CONTENT)
                    }
                    if (itemDisc > 0 && !isVoided) {
                        val origPriceTv = TextView(context).apply {
                            val orig = itemObj.optDouble("originalPrice", 0.0)
                            text = "$currencySymbol${currencyFormat.format(orig)}"
                            textSize = 11f
                            setTextColor(Color.parseColor("#94A3B8"))
                            paintFlags = paintFlags or android.graphics.Paint.STRIKE_THRU_TEXT_FLAG
                        }
                        totalCol.addView(origPriceTv)
                    }
                    val finalPriceTv = TextView(context).apply {
                        val finalP = itemObj.optDouble("finalPrice", 0.0)
                        text = "$currencySymbol${currencyFormat.format(finalP)}"
                        textSize = 14f
                        setTypeface(null, Typeface.BOLD)
                        setTextColor(if (isVoided) Color.parseColor("#94A3B8") else Color.parseColor("#0F172A"))
                    }
                    totalCol.addView(finalPriceTv)

                    itemLayout.addView(descCol)
                    itemLayout.addView(qtyTv)
                    itemLayout.addView(totalCol)

                    cartItemsContainer.addView(itemLayout)
                    cartItemsContainer.addView(createDivider())
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error updating presentation data", e)
        }
    }

    private fun loadImageAsync(url: String, imageView: java.lang.ImageView) {
        imageView.tag = url
        executor.execute {
            try {
                val conn = java.net.URL(url).openConnection()
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                val inputStream = conn.getInputStream()
                val bitmap = BitmapFactory.decodeStream(inputStream)
                mainHandler.post {
                    if (imageView.tag == url) {
                        imageView.setImageBitmap(bitmap)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load image from url: $url", e)
            }
        }
    }
}
