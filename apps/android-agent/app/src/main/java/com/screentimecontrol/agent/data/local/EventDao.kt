package com.screentimecontrol.agent.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update

@Dao
interface EventDao {
    @Insert
    suspend fun insert(event: EventEntity): Long

    @Query("SELECT * FROM events WHERE uploaded = 0 ORDER BY id ASC LIMIT :limit")
    suspend fun pending(limit: Int = 100): List<EventEntity>

    @Update
    suspend fun update(event: EventEntity)

    @Query("DELETE FROM events WHERE uploaded = 1 AND createdAtMs < :beforeMs")
    suspend fun purgeUploadedBefore(beforeMs: Long)
}
