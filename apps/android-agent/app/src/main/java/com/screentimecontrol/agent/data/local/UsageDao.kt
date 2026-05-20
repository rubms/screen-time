package com.screentimecontrol.agent.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface UsageDao {
    @Query("SELECT * FROM usage_today WHERE localDate = :localDate")
    suspend fun forDate(localDate: String): List<UsageTodayEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: UsageTodayEntity)

    @Query("DELETE FROM usage_today WHERE localDate != :localDate")
    suspend fun deleteOtherDates(localDate: String)
}
