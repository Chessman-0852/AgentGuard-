# tests/unit/test_razorpay_client.py
import hmac
import hashlib
import pytest
from agentguard.executor.razorpay_client import validate_webhook_signature


class TestWebhookValidation:

    def _make_signature(self, body: bytes, secret: str) -> str:
        """Helper: compute the correct HMAC-SHA256 signature."""
        return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    def test_valid_signature_returns_true(self):
        """Correct HMAC on the correct body must return True."""
        body = b'{"event":"payment.captured"}'
        secret = "test_webhook_secret_abc123"
        sig = self._make_signature(body, secret)
        assert validate_webhook_signature(body, sig, secret) is True

    def test_invalid_signature_returns_false(self):
        """A garbage signature string must return False."""
        body = b'{"event":"payment.captured"}'
        secret = "test_webhook_secret_abc123"
        assert validate_webhook_signature(body, "invalid_signature_garbage", secret) is False

    def test_tampered_body_returns_false(self):
        """Correct signature computed on original body must fail against tampered body."""
        body = b'{"event":"payment.captured"}'
        secret = "test_webhook_secret_abc123"
        sig = self._make_signature(body, secret)
        tampered = b'{"event":"payment.captured","amount":9999999}'
        assert validate_webhook_signature(tampered, sig, secret) is False

    def test_wrong_secret_returns_false(self):
        """Signature computed with correct secret must fail when verified with wrong secret."""
        body = b'{"event":"payment.captured"}'
        correct_secret = "correct_secret_xyz"
        wrong_secret = "wrong_secret_abc"
        sig = self._make_signature(body, correct_secret)
        assert validate_webhook_signature(body, sig, wrong_secret) is False

    def test_production_key_rejected_at_startup(self, monkeypatch):
        """RAZORPAY_KEY_ID not starting with rzp_test_ must raise RuntimeError immediately."""
        monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_productionkeyXYZ")
        monkeypatch.setenv("RAZORPAY_KEY_SECRET", "some_production_secret")
        import agentguard.executor.razorpay_client as rc
        rc._client = None   # reset cached singleton
        with pytest.raises(RuntimeError, match="rzp_test_"):
            rc._get_client()
        rc._client = None   # cleanup for other tests
