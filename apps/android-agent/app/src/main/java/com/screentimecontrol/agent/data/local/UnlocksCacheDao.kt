package com.screentimecontrol.agent.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface UnlocksCacheDao {
    @Query("SELECT * FROM unlocks_cache WHERE revoked = 0 AND expiresAtMs > :nowMs")
    suspend fun active(nowMs: Long = System.currentTimeMillis()): List<UnlocksCacheEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<UnlocksCacheEntity>)

    @Query("DELETE FROM unlocks_cache")
    suspend fun clear()
}
