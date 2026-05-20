package com.screentimecontrol.agent.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "usage_today")
data class UsageTodayEntity(
    @PrimaryKey val targetId: String,
    val localDate: String,
    val minutes: Double,
)
