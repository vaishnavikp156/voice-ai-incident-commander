"""
Agora RTC Token Builder
Uses official agora_token_builder to generate standard, verified Agora AccessTokens (v006).
"""

import time
import logging
from typing import Optional

logger = logging.getLogger("agora_token")

try:
    from agora_token_builder import RtcTokenBuilder
    HAS_OFFICIAL_BUILDER = True
except ImportError:
    HAS_OFFICIAL_BUILDER = False
    logger.warning("[AgoraTokenBuilder] agora_token_builder package not found, using pure python fallback.")


class AgoraTokenBuilder:
    ROLE_PUBLISHER = 1
    ROLE_SUBSCRIBER = 2

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
        """Build an Agora RTC Token with numeric UID."""
        if not app_id:
            return ""

        if not app_certificate:
            # For projects without certificate enabled
            return ""

        if privilege_expired_ts == 0:
            privilege_expired_ts = int(time.time()) + 86400  # 24 hours validity

        if HAS_OFFICIAL_BUILDER:
            return RtcTokenBuilder.buildTokenWithUid(
                appId=app_id,
                appCertificate=app_certificate,
                channelName=channel_name,
                uid=uid,
                role=role,
                privilegeExpiredTs=privilege_expired_ts,
            )
        else:
            raise RuntimeError("agora-token-builder package is required for generating valid Agora RTC tokens.")

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
        if not app_id or not app_certificate:
            return ""

        if privilege_expired_ts == 0:
            privilege_expired_ts = int(time.time()) + 86400

        if HAS_OFFICIAL_BUILDER:
            return RtcTokenBuilder.buildTokenWithAccount(
                appId=app_id,
                appCertificate=app_certificate,
                channelName=channel_name,
                account=user_account,
                role=role,
                privilegeExpiredTs=privilege_expired_ts,
            )
        else:
            raise RuntimeError("agora-token-builder package is required for generating valid Agora RTC tokens.")
