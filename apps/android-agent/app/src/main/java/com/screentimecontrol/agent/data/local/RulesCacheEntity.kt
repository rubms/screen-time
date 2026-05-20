package com.screentimecontrol.agent.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "rules_cache")
data class RulesCacheEntity(
    @PrimaryKey val id: Int = 1,
    val rulesJson: String,
    val version: Int,
    val updatedAtMs: Long,
)
