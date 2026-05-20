package com.screentimecontrol.agent.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "unlocks_cache")
data class UnlocksCacheEntity(
    @PrimaryKey val unlockId: String,
    val payloadJson: String,
    val expiresAtMs: Long,
    val revoked: Boolean,
)
