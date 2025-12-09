SELECT a.master_incident_number,methodofcallRcvd AS AAN_Status, Time_CallEnteredQueue,Problem,Response_Area
FROM [TSTA_System_930].dbo.response_master_incident a 
    INNER JOIN [TSTA_System_930].dbo.Response_Comments b 
    ON b.master_incident_id=a.id 
WHERE 
    a.Call_Is_Active=1
    AND datediff(day, a.Time_CallEnteredQueue, getdate()) <=15
    AND LTRIM(b.comment) LIKE '%CIP SN solution (SN01)] Fire notification SENT%' 
    AND a.methodofcallRcvd not in ('FD-To','FD-C')
ORDER BY Time_CallEnteredQueue DESC;