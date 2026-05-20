package com.screentimecontrol.agent.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "events")
data class EventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val eventType: String,
    val payloadJson: String,
    val localDate: String,
    val atIso: String,
    val uploaded: Boolean = false,
    val createdAtMs: Long = System.currentTimeMillis(),
)
