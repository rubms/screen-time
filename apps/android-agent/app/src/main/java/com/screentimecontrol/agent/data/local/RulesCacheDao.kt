package com.screentimecontrol.agent.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface RulesCacheDao {
    @Query("SELECT * FROM rules_cache WHERE id = 1 LIMIT 1")
    suspend fun current(): RulesCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: RulesCacheEntity)
}
