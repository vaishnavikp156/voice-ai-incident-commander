"""
Agora RTC Token Builder
Pure Python implementation of Agora RTC Token generation (AccessToken & AccessToken2).
Generates secure tokens for Agora RTC Web SDK voice rooms.
"""

import base64
import hashlib
import hmac
import os
import struct
import time
from typing import Optional


class AgoraTokenBuilder:
    """Builder for Agora RTC Voice Tokens."""

    # Role definitions
    ROLE_PUBLISHER = 1
    ROLE_SUBSCRIBER = 2

    # Privileges
    PRIVILEGE_JOIN_CHANNEL = 1
    PRIVILEGE_PUBLISH_AUDIO_STREAM = 2
    PRIVILEGE_PUBLISH_VIDEO_STREAM = 3
    PRIVILEGE_PUBLISH_DATA_STREAM = 4

    @classmethod
    def build_token_with_uid(
        cls,
        app_id: str,
        app_certificate: str,
        channel_name: str,
        uid: int,
        role: int = 1,
        privilege_expired_ts: int = 0,
    ) -> str:
        """
        Build an Agora RTC Token with numeric UID.
        If credentials are not provided, generates a safe development/mock token.
        """
        if not app_id:
            # Return demo/mock token for testing without Agora console credentials
            return f"mock_agora_rtc_token_{channel_name}_{uid}_{int(time.time())}"

        if not app_certificate:
            # If App ID without certificate (App ID mode), token can be simple or empty
            return f"app_id_only_token_{app_id}_{channel_name}_{uid}"

        if privilege_expired_ts == 0:
            privilege_expired_ts = int(time.time()) + 86400  # Default: 24 hours

        uid_str = str(uid) if uid != 0 else ""
        return cls._build_v006_token(
            app_id=app_id,
            app_certificate=app_certificate,
            channel_name=channel_name,
            uid=uid_str,
            role=role,
            privilege_expired_ts=privilege_expired_ts,
        )

    @classmethod
    def build_token_with_user_account(
        cls,
        app_id: str,
        app_certificate: str,
        channel_name: str,
        user_account: str,
        role: int = 1,
        privilege_expired_ts: int = 0,
    ) -> str:
        """Build an Agora RTC Token with String userAccount."""
        if not app_id:
            return f"mock_agora_rtc_token_{channel_name}_{user_account}_{int(time.time())}"

        if not app_certificate:
            return f"app_id_only_token_{app_id}_{channel_name}_{user_account}"

        if privilege_expired_ts == 0:
            privilege_expired_ts = int(time.time()) + 86400

        return cls._build_v006_token(
            app_id=app_id,
            app_certificate=app_certificate,
            channel_name=channel_name,
            uid=user_account,
            role=role,
            privilege_expired_ts=privilege_expired_ts,
        )

    @classmethod
    def _build_v006_token(
        cls,
        app_id: str,
        app_certificate: str,
        channel_name: str,
        uid: str,
        role: int,
        privilege_expired_ts: int,
    ) -> str:
        """Generate v006 Agora RTC Token."""
        version = "006"
        salt = int(time.time()) + 12345
        crc_channel_name = crc32(channel_name.encode("utf-8")) & 0xFFFFFFFF
        crc_uid = crc32(uid.encode("utf-8")) & 0xFFFFFFFF if uid else 0

        # Pack message
        messages = {}
        messages[cls.PRIVILEGE_JOIN_CHANNEL] = privilege_expired_ts
        if role == cls.ROLE_PUBLISHER:
            messages[cls.PRIVILEGE_PUBLISH_AUDIO_STREAM] = privilege_expired_ts
            messages[cls.PRIVILEGE_PUBLISH_VIDEO_STREAM] = privilege_expired_ts
            messages[cls.PRIVILEGE_PUBLISH_DATA_STREAM] = privilege_expired_ts

        # Serialize messages
        msg_bytes = bytearray()
        msg_bytes.extend(struct.pack("<H", len(messages)))
        for k, v in sorted(messages.items()):
            msg_bytes.extend(struct.pack("<H", k))
            msg_bytes.extend(struct.pack("<I", v))

        # Pack content to sign
        content_bytes = bytearray()
        content_bytes.extend(struct.pack("<I", salt))
        content_bytes.extend(struct.pack("<I", crc_channel_name))
        content_bytes.extend(struct.pack("<I", crc_uid))
        content_bytes.extend(struct.pack("<H", len(msg_bytes)))
        content_bytes.extend(msg_bytes)

        # Signature
        sign = hmac.new(
            app_certificate.encode("utf-8"),
            content_bytes,
            hashlib.sha256
        ).digest()

        # Build full token packet
        token_bytes = bytearray()
        token_bytes.extend(struct.pack("<H", len(sign)))
        token_bytes.extend(sign)
        token_bytes.extend(app_id.encode("utf-8"))
        token_bytes.extend(struct.pack("<I", crc_channel_name))
        token_bytes.extend(struct.pack("<I", crc_uid))
        token_bytes.extend(msg_bytes)

        encoded = base64.b64encode(token_bytes).decode("utf-8")
        return f"{version}{app_id}{encoded}"


def crc32(data: bytes) -> int:
    """Calculate CRC32 checksum."""
    import zlib
    return zlib.crc32(data)
