package com.screentimecontrol.agent.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        EventEntity::class,
        UsageTodayEntity::class,
        RulesCacheEntity::class,
        UnlocksCacheEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun eventDao(): EventDao
    abstract fun usageDao(): UsageDao
    abstract fun rulesCacheDao(): RulesCacheDao
    abstract fun unlocksCacheDao(): UnlocksCacheDao

    companion object {
        @Volatile
        private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "screen_time_state.db",
                )
                    .enableMultiInstanceInvalidation()
                    .build()
                    .also { instance = it }
            }
    }
}
