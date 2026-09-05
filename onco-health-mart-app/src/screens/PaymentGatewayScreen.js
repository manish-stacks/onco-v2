import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Screen from '../components/Screen';
import { AppHeader } from '../components/ui';
import { colors } from '../theme';
import { orderApi } from '../api';
import { API_BASE } from '../api/client';
import { useCart } from '../store/CartContext';
import { useToast } from '../store/ToastContext';

/**
 * Runs the gateway checkout inside a WebView.
 *  • Razorpay  -> checkout.js is loaded in a page, the handler posts the
 *                 signature back and we call /orders/verify-payment
 *  • PayU      -> a hidden form is auto-submitted to the PayU endpoint,
 *                 and afterwards we call /payments/payu/verify with the txnid
 */
export default function PaymentGatewayScreen({ route, navigation }) {
  const { order, payment } = route.params || {};
  const [verifying, setVerifying] = useState(false);
  const handled = useRef(false);
  const { refresh } = useCart();
  const toast = useToast();

  const gateway = payment?.gateway || (payment?.razorpay ? 'razorpay' : 'payu');

  const finishSuccess = async (updatedOrder) => {
    await refresh();
    navigation.replace('OrderSuccess', { order: updatedOrder || order });
  };

  const finishFailure = (message) => {
    toast.show(message || 'Payment was not completed', 'error');
    navigation.replace('OrderDetail', { orderId: order?.order_id, paymentFailed: true });
  };

  const verifyRazorpay = async (data) => {
    setVerifying(true);
    try {
      const updated = await orderApi.verifyRazorpay({
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
      });
      await finishSuccess(updated);
    } catch (e) {
      finishFailure(e.message);
    } finally {
      setVerifying(false);
    }
  };

  const verifyPayu = async (txnid) => {
    setVerifying(true);
    try {
      const updated = await orderApi.verifyPayu(txnid);
      await finishSuccess(updated);
    } catch (e) {
      finishFailure(e.message);
    } finally {
      setVerifying(false);
    }
  };

  const html = useMemo(() => {
    if (gateway === 'payu' && payment?.payu) {
      const inputs = Object.entries(payment.payu.params || {})
        .map(
          ([k, v]) =>
            `<input type="hidden" name="${k}" value="${String(v ?? '').replace(/"/g, '&quot;')}" />`
        )
        .join('');
      return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;height:100vh;align-items:center;justify-content:center;color:#6B7A85}</style>
</head><body><p>Redirecting to PayU...</p>
<form id="payuForm" method="post" action="${payment.payu.endpoint}">${inputs}</form>
<script>document.getElementById('payuForm').submit();</script>
</body></html>`;
    }

    const rzp = payment?.razorpay || {};
    const prefill = rzp.prefill || {};
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;height:100vh;align-items:center;justify-content:center;color:#6B7A85}</style>
</head><body><p>Opening secure payment...</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
function send(payload){ window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
var options = {
  key: ${JSON.stringify(rzp.key_id || '')},
  order_id: ${JSON.stringify(rzp.order_id || '')},
  amount: ${JSON.stringify(rzp.amount || 0)},
  currency: ${JSON.stringify(rzp.currency || 'INR')},
  name: 'Onco Health Mart',
  description: 'Order ${String(order?.databaseOrderID || '')}',
  prefill: {
    name: ${JSON.stringify(prefill.name || '')},
    contact: ${JSON.stringify(prefill.contact || '')},
    email: ${JSON.stringify(prefill.email || '')}
  },
  theme: { color: '#2E9FE3' },
  modal: { ondismiss: function(){ send({ status:'cancelled' }); } },
  handler: function(response){ send({ status:'success', ...response }); }
};
var rzpInstance = new Razorpay(options);
rzpInstance.on('payment.failed', function(resp){
  send({ status:'failed', message: (resp && resp.error && resp.error.description) || 'Payment failed' });
});
rzpInstance.open();
</script></body></html>`;
  }, [gateway, payment, order]);

  const onMessage = (event) => {
    if (handled.current) return;
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (data.status === 'success') {
      handled.current = true;
      verifyRazorpay(data);
    } else if (data.status === 'cancelled') {
      handled.current = true;
      Alert.alert('Payment cancelled', 'Your order is saved. You can retry the payment from your orders.', [
        { text: 'OK', onPress: () => finishFailure('Payment cancelled') },
      ]);
    } else if (data.status === 'failed') {
      handled.current = true;
      finishFailure(data.message);
    }
  };

  /** PayU redirects back to the backend success/failure URLs — detect and verify */
  const onNavChange = (navState) => {
    if (gateway !== 'payu' || handled.current) return;
    const url = navState.url || '';
    if (!url.startsWith(API_BASE)) return;
    if (url.includes('/payments/payu/success')) {
      handled.current = true;
      verifyPayu(payment?.gateway_order_id || payment?.payu?.params?.txnid);
    } else if (url.includes('/payments/payu/failure')) {
      handled.current = true;
      finishFailure('The payment failed at PayU');
    }
  };

  // Razorpay's checkout tries to hand off UPI payments to apps like GPay/PhonePe
  // via non-http links (upi://, tez://, phonepe://, intent://...). A bare
  // WebView can't load those — it just fails and Razorpay shows "some payment
  // methods are unavailable / use another method". We intercept those URLs and
  // hand them to the OS via Linking, which opens the actual app.
  const onShouldStartLoadWithRequest = (req) => {
    const url = req?.url || '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('about:')) {
      return true;
    }
    Linking.openURL(url).catch(() => {
      // No app installed to handle this UPI link — let Razorpay's own
      // "app not found" messaging in the checkout UI handle it.
    });
    return false;
  };

  return (
    <Screen>
      <AppHeader title="Secure Payment" back />
      <View style={{ flex: 1 }}>
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://oncohealthmart.com' }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          onNavigationStateChange={onNavChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        />
        {verifying ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.overlayText}>Confirming your payment...</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { marginTop: 14, fontSize: 13, color: colors.muted },
});
